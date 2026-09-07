import type { Page, Locator } from "playwright";
import { ConversationLocator } from "./ConversationLocator.js";
import type { BrowserConversationState } from "./ConversationState.js";
import type { AssistantMessageSnapshot } from "./AssistantMessageSnapshot.js";

const CHATGPT_COMPOSER_SELECTOR = [
  '[data-testid="composer-text-input"]:visible',
  '#prompt-textarea:visible',
  '[contenteditable="true"][role="textbox"]:visible',
  'div.ProseMirror[contenteditable="true"]:visible',
  '[contenteditable="true"][data-virtualkeyboard="true"]:visible',
  'form [contenteditable="true"]:visible',
  'textarea[name="prompt-textarea"]:visible',
  'textarea:visible',
].join(', ');

const CHATGPT_SEND_BUTTON_SELECTOR = [
  'button[data-testid="send-button"]',
  'form button[aria-label="Send"]',
  'form button[aria-label="Send prompt"]',
  'form button[aria-label="Send message"]',
  'form button[type="submit"]',
].join(', ');

function normalizeVisibleText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export class ConversationManager {
  private state: BrowserConversationState = "idle";
  private readonly locator: ConversationLocator;
  private outboundChain: Promise<void> = Promise.resolve();

  constructor(private readonly page: Page) {
    this.locator = new ConversationLocator(page);
  }

  getState(): BrowserConversationState {
    return this.state;
  }

  async open(url: string): Promise<void> {
    this.state = "opening";

    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
    });

    this.state = "ready";
  }

  async readLatestAssistantMessage(): Promise<AssistantMessageSnapshot | null> {
    const messages = this.locator.assistantMessages();
    const count = await messages.count();

    if (count === 0) {
      return null;
    }

    const latest = messages.nth(count - 1);

    try {
      const id = await latest.getAttribute("data-message-id", {
        timeout: 3000,
      });

      const text = await latest.textContent({
        timeout: 3000,
      });

      if (!id || !text) {
        return null;
      }

      return {
        id,
        text,
      };
    } catch {
      return null;
    }
  }

  async waitForStableAssistantMessage(
    afterMessageId: string | null,
    stableMs = 1500,
  ): Promise<AssistantMessageSnapshot> {
    if (this.page.isClosed()) {
      throw new Error("Browser page is closed.");
    }

    return this.page.evaluate(
      ({ afterMessageId, stableMs }) =>
        new Promise<AssistantMessageSnapshot>((resolve) => {
          const selector =
            '[data-message-author-role="assistant"][data-message-id]';

          let candidateId: string | null = null;
          let candidateText = "";
          let timer: ReturnType<typeof setTimeout> | null = null;

          const cleanup = () => {
            observer.disconnect();
            if (timer) {
              clearTimeout(timer);
            }
          };

          const inspect = () => {
            const messages = Array.from(
              document.querySelectorAll<HTMLElement>(selector),
            );
            const latest = messages.at(-1);

            if (!latest) {
              return;
            }

            const id = latest.getAttribute("data-message-id");
            const text = latest.textContent ?? "";

            if (!id || id === afterMessageId || !text.trim()) {
              return;
            }

            if (id !== candidateId || text !== candidateText) {
              candidateId = id;
              candidateText = text;

              if (timer) {
                clearTimeout(timer);
              }

              timer = setTimeout(() => {
                cleanup();
                resolve({ id, text });
              }, stableMs);
            }
          };

          const observer = new MutationObserver(inspect);
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
          });

          inspect();
        }),
      {
        afterMessageId,
        stableMs,
      },
    );
  }

  async sendMessage(message: string): Promise<void> {
    const run = this.outboundChain
      .catch(() => undefined)
      .then(() => this.sendMessageOnce(message));

    // Keep one global conversation-level transport lane so status, report,
    // continuation and reminder senders cannot write into the composer at the
    // same time. A failed send must not poison later sends.
    this.outboundChain = run.catch(() => undefined);
    return run;
  }

  private async sendMessageOnce(message: string): Promise<void> {
    const input = await this.getMessageInput();
    await this.assertComposerEmpty(input);

    const userMessages = this.page.locator(
      '[data-message-author-role="user"]',
    );
    const userMessageCountBeforeSubmit = await userMessages
      .count()
      .catch(() => 0);
    const signature = this.submissionSignature(message);

    await input.click({
      force: true,
    });

    await this.page.keyboard.insertText(message);
    await this.page.waitForTimeout(300);

    try {
      await this.submitMessage(input);
      await this.confirmMessageSubmitted(
        userMessageCountBeforeSubmit,
        signature,
      );
      this.state = "ready";
    } catch (error) {
      await this.cleanupOwnedDraft(input, message, signature);
      this.state = "error";
      throw error;
    }
  }

  private async confirmMessageSubmitted(
    userMessageCountBeforeSubmit: number,
    signature: string,
  ): Promise<void> {
    const timeoutMs = 12000;
    const pollIntervalMs = 200;
    const deadline = Date.now() + timeoutMs;
    const normalizedSignature = normalizeVisibleText(signature);

    while (Date.now() < deadline) {
      const userMessages = this.page.locator(
        '[data-message-author-role="user"]',
      );
      const currentCount = await userMessages
        .count()
        .catch(() => userMessageCountBeforeSubmit);

      if (currentCount > userMessageCountBeforeSubmit) {
        for (
          let index = userMessageCountBeforeSubmit;
          index < currentCount;
          index += 1
        ) {
          const text = await userMessages
            .nth(index)
            .textContent()
            .catch(() => null);

          if (
            text &&
            normalizeVisibleText(text).includes(normalizedSignature)
          ) {
            return;
          }
        }
      }

      await this.page.waitForTimeout(pollIntervalMs);
    }

    throw new Error(
      `ChatGPT message submission could not be confirmed by a matching user message (${signature}).`,
    );
  }

  private async assertComposerEmpty(input: Locator): Promise<void> {
    const composerText = await this.readComposerText(input);
    if (composerText.length === 0) {
      return;
    }

    throw new Error(
      "ChatGPT composer is occupied; Keynu refused to append to or overwrite an existing draft.",
    );
  }

  private async readComposerText(input: Locator): Promise<string> {
    const text = await input.evaluate((element) => {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
      ) {
        return element.value;
      }

      if (element instanceof HTMLElement) {
        return element.innerText ?? element.textContent ?? "";
      }

      throw new Error("Unsupported ChatGPT composer element.");
    });

    return normalizeVisibleText(String(text ?? ""));
  }

  private submissionSignature(message: string): string {
    const kapId = message.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
    if (kapId) {
      return kapId;
    }

    const normalized = normalizeVisibleText(message)
      .replace(/```(?:kap)?/gi, "")
      .trim();

    return normalized.slice(0, 96) || "Keynu outbound message";
  }

  private async cleanupOwnedDraft(
    input: Locator,
    message: string,
    signature: string,
  ): Promise<void> {
    const current = await this.readComposerText(input).catch(() => "");
    if (!current) {
      return;
    }

    const normalizedMessage = normalizeVisibleText(message);
    const kapId = message.match(/"id"\s*:\s*"([^"]+)"/)?.[1];
    const ownsDraft =
      current === normalizedMessage ||
      Boolean(kapId && current.includes(normalizeVisibleText(signature)));

    if (!ownsDraft) {
      return;
    }

    const cleared = await input
      .fill("")
      .then(() => true)
      .catch(() => false);

    if (cleared) {
      return;
    }

    await input.click({ force: true }).catch(() => undefined);
    await this.page.keyboard
      .press(process.platform === "darwin" ? "Meta+A" : "Control+A")
      .catch(() => undefined);
    await this.page.keyboard.press("Backspace").catch(() => undefined);
  }

  private async getMessageInput(): Promise<Locator> {
    if (this.page.isClosed()) {
      throw new Error(
        "ChatGPT message input was not found because the browser page is closed",
      );
    }

    const candidate = this.page.locator(CHATGPT_COMPOSER_SELECTOR).last();

    try {
      // ChatGPT's application shell can reach DOMContentLoaded before the
      // composer is hydrated, especially on project/custom-GPT conversation
      // routes. Wait for the live composer instead of checking synchronously
      // and failing during that hydration window.
      await candidate.waitFor({
        state: "visible",
        timeout: 20000,
      });
      return candidate;
    } catch {
      throw new Error(
        "ChatGPT message input was not found after waiting for composer hydration",
      );
    }
  }

  private async submitMessage(input: Locator): Promise<void> {
    const sendButton = this.page
      .locator(CHATGPT_SEND_BUTTON_SELECTOR)
      .last();

    if ((await sendButton.count().catch(() => 0)) > 0) {
      try {
        await sendButton.waitFor({
          state: "visible",
          timeout: 5000,
        });

        for (let attempt = 0; attempt < 20; attempt += 1) {
          const disabled = await sendButton
            .evaluate((button) => {
              if (button instanceof HTMLButtonElement) {
                return button.disabled;
              }

              return (
                button.getAttribute("disabled") !== null ||
                button.getAttribute("aria-disabled") === "true"
              );
            })
            .catch(() => true);

          if (!disabled) {
            await sendButton.click({
              force: true,
              timeout: 5000,
              noWaitAfter: true,
            });
            await this.page.waitForTimeout(250);
            return;
          }

          await this.page.waitForTimeout(250);
        }
      } catch {
        // Fall through to keyboard submission. Confirmation remains strict and
        // will reject the send if no matching user-authored DOM message appears.
      }
    }

    await input
      .press("Enter")
      .catch(async () => {
        await input.press(
          process.platform === "darwin"
            ? "Meta+Enter"
            : "Control+Enter",
        );
      });
  }
}
