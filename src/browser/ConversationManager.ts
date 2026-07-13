import type { Page, Locator } from "playwright";
import { ConversationLocator } from "./ConversationLocator.js";
import type { BrowserConversationState } from "./ConversationState.js";
import type { AssistantMessageSnapshot } from "./AssistantMessageSnapshot.js";

export class ConversationManager {
  private state: BrowserConversationState = "idle";
  private readonly locator: ConversationLocator;

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

            const messages =
              Array.from(
                document.querySelectorAll<HTMLElement>(selector),
              );


            const latest = messages.at(-1);

            if (!latest) {
              return;
            }


            const id =
              latest.getAttribute("data-message-id");

            const text =
              latest.textContent ?? "";


            if (!id || id === afterMessageId || !text.trim()) {
              return;
            }


            if (
              id !== candidateId ||
              text !== candidateText
            ) {

              candidateId = id;
              candidateText = text;


              if (timer) {
                clearTimeout(timer);
              }


              timer = setTimeout(() => {

                cleanup();

                resolve({
                  id,
                  text,
                });

              }, stableMs);
            }
          };


          const observer =
            new MutationObserver(inspect);


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

    const input = await this.getMessageInput();

    await input.click({
      force: true,
    });

    await this.page.keyboard.insertText(message);

    await this.page.waitForTimeout(300);

    await this.submitMessage(input);

    this.state = "ready";
  }


  private async getMessageInput(): Promise<Locator> {

    const selectors = [
      '[contenteditable="true"][role="textbox"]',
      '[data-testid="composer-text-input"]',
      '#prompt-textarea',
      'div[contenteditable="true"]',
      'textarea:visible',
    ];


    for (const selector of selectors) {

      const candidate =
        this.page.locator(selector).last();


      if ((await candidate.count()) > 0) {

        try {

          await candidate.waitFor({
            state: "visible",
            timeout: 3000,
          });

          return candidate;

        } catch {}
      }
    }


    throw new Error(
      "ChatGPT message input was not found",
    );
  }


  private async submitMessage(input: Locator): Promise<void> {

    const sendButton =
      this.page
        .locator(
          'button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Send message"]',
        )
        .last();


    if ((await sendButton.count()) > 0) {

      try {

        await sendButton.waitFor({
          state: "visible",
          timeout: 5000,
        });


        for (let attempt = 0; attempt < 20; attempt += 1) {

          const disabled =
            await sendButton
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


            await this.page.waitForTimeout(500);

            return;
          }


          await this.page.waitForTimeout(250);
        }

      } catch {}
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