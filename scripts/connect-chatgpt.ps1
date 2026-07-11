$ErrorActionPreference='Stop'

Write-Host '=== Keynu ChatGPT Connector v07 ==='
Write-Host 'Starting safe isolated Keynu Chrome...'

powershell -ExecutionPolicy Bypass -File scripts\start-keynu-chrome.ps1

Write-Host ''
Write-Host '1. In the Keynu Chrome window, open ChatGPT.'
Write-Host '2. Create a NEW chat.'
Write-Host '3. Copy the new chat URL.'
Write-Host ''

$url = Read-Host 'Paste ChatGPT conversation URL here'

if (-not $url -or -not $url.StartsWith('http')) {
  throw 'Invalid ChatGPT URL.'
}

$env:KEYNU_CONVERSATION_URL=$url

Write-Host ''
Write-Host 'Starting Browser Agent connected to:'
Write-Host $url
Write-Host ''
Write-Host 'Leave this terminal open.'
Write-Host ''

npm run browser-agent
