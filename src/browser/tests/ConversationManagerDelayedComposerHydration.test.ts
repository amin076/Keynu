import { strict as assert } from "node:assert";
import { chromium } from "playwright";
import { ConversationManager } from "../ConversationManager.js";

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();

  await page.setContent(`<!doctype html>
    <html>
      <body>
        <main id="app-shell"></main>
        <div id="submitted-message"></div>
        <div id="conversation"></div>
        <script>
          setTimeout(() => {
            const composer = document.createElement('div');
            composer.setAttribute('data-testid', 'composer-text-input');
            composer.setAttribute('contenteditable', 'true');

            const send = document.createElement('button');
            send.setAttribute('data-testid', 'send-button');
            send.textContent = 'Send';
            send.addEventListener('click', () => {
              const text = composer.textContent || '';
              document.querySelector('#submitted-message').textContent = text;

              const userMessage = document.createElement('div');
              userMessage.setAttribute('data-message-author-role', 'user');
              userMessage.textContent = text;
              document.querySelector('#conversation').appendChild(userMessage);

              composer.textContent = '';
              composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
            });

            document.querySelector('#app-shell').append(composer, send);
          }, 700);
        </script>
      </body>
    </html>`);

  const manager = new ConversationManager(page);
  const startedAt = Date.now();

  await manager.sendMessage("delayed composer verification");

  assert.ok(
    Date.now() - startedAt >= 500,
    "ConversationManager should wait for the hydrated composer instead of failing synchronously.",
  );
  assert.equal(
    await page.locator("#submitted-message").textContent(),
    "delayed composer verification",
  );
  assert.equal(
    await page.locator('[data-message-author-role="user"]').textContent(),
    "delayed composer verification",
  );
  assert.equal(manager.getState(), "ready");

  console.log("PASS ConversationManagerDelayedComposerHydration");
} finally {
  await browser.close();
}
