import { strict as assert } from "node:assert";
import { chromium } from "playwright";
import { ConversationManager } from "../ConversationManager.js";

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();

  await page.setContent(
    `<!doctype html>
    <html>
      <body>
        <main>
          <form id="composer-form">
            <div
              id="prompt-textarea"
              class="ProseMirror"
              contenteditable="true"
              data-virtualkeyboard="true"
              role="textbox"
            ></div>
            <button type="submit" data-testid="send-button">Send</button>
          </form>
          <div id="submitted-message"></div>
          <div id="conversation"></div>
        </main>
        <script>
          const form = document.querySelector('#composer-form');
          const composer = document.querySelector('#prompt-textarea');
          const submitted = document.querySelector('#submitted-message');
          const conversation = document.querySelector('#conversation');

          form.addEventListener('submit', (event) => {
            event.preventDefault();
            const text = composer.textContent || '';
            submitted.textContent = text;

            const userMessage = document.createElement('div');
            userMessage.setAttribute('data-message-author-role', 'user');
            userMessage.textContent = text;
            conversation.appendChild(userMessage);

            composer.textContent = '';
            composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
          });
        </script>
      </body>
    </html>`,
  );

  const manager = new ConversationManager(page);
  await manager.sendMessage("contenteditable composer verification");

  assert.equal(
    await page.locator("#submitted-message").textContent(),
    "contenteditable composer verification",
  );
  assert.equal(
    await page.locator('[data-message-author-role="user"]').textContent(),
    "contenteditable composer verification",
  );
  assert.equal(
    await page.locator("#prompt-textarea").textContent(),
    "",
  );
  assert.equal(manager.getState(), "ready");

  console.log("PASS ConversationManagerContentEditableComposer");
} finally {
  await browser.close();
}
