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
        </main>
        <script>
          const form = document.querySelector('#composer-form');
          const composer = document.querySelector('#prompt-textarea');
          const submitted = document.querySelector('#submitted-message');

          form.addEventListener('submit', (event) => {
            event.preventDefault();
            submitted.textContent = composer.textContent || '';
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
    await page.locator("#prompt-textarea").textContent(),
    "",
  );
  assert.equal(manager.getState(), "ready");

  console.log("PASS ConversationManagerContentEditableComposer");
} finally {
  await browser.close();
}
