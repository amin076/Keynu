export function printBrowserAgentMissingUrlHelp(): void {
  console.error('');
  console.error('Keynu Browser Agent needs a ChatGPT conversation URL.');
  console.error('');
  console.error('What you should do:');
  console.error('');
  console.error('1. Open Chrome with remote debugging:');
  console.error('   chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\keynu-chrome"');
  console.error('');
  console.error('2. Open your ChatGPT conversation in that Chrome window.');
  console.error('');
  console.error('3. Copy the full conversation URL.');
  console.error('');
  console.error('4. In PowerShell run:');
  console.error('   $env:KEYNU_CONVERSATION_URL="https://chatgpt.com/c/YOUR_CONVERSATION_ID"');
  console.error('   npm run browser-agent');
  console.error('');
}

export function printBrowserAgentStartupHelp(conversationUrl: string): void {
  console.log('');
  console.log('======================');
  console.log('Keynu Browser Agent');
  console.log('======================');
  console.log('');
  console.log('Connection target: ChatGPT conversation');
  console.log('Conversation URL: ' + conversationUrl);
  console.log('');
  console.log('What Keynu can do now:');
  console.log('- Watch this ChatGPT conversation.');
  console.log('- Find KAP JOB blocks from ChatGPT.');
  console.log('- Route target=powershell jobs.');
  console.log('- Read files, write files, create folders, run commands, and run builds.');
  console.log('- Start and inspect long-running processes through Process Manager.');
  console.log('');
  console.log('Requirements:');
  console.log('- Chrome must be running with --remote-debugging-port=9222.');
  console.log('- KEYNU_CONVERSATION_URL must point to the watched ChatGPT conversation.');
  console.log('- Run npm run build after code changes.');
  console.log('');
  console.log('Watching dedicated conversation...');
  console.log('');
}
