$ErrorActionPreference = 'Stop'
$port = 9222
$userDataDir = 'C:\keynu-chrome'
$url = 'https://chatgpt.com/'

Write-Host 'Checking Keynu Chrome remote debugging port...'

try {
  $version = Invoke-RestMethod "http://127.0.0.1:$port/json/version" -TimeoutSec 2
  Write-Host "Keynu Chrome already running on port $port"
  Write-Host "Browser: $($version.Browser)"
  Start-Process "http://127.0.0.1:$port"
  exit 0
} catch {
  Write-Host "No Chrome remote debugging session found on port $port. Starting isolated Keynu Chrome..."
}

New-Item -ItemType Directory -Force -Path $userDataDir | Out-Null

$chromeCandidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  throw 'Chrome executable not found. Please install Google Chrome or add it to PATH.'
}

Start-Process $chrome -ArgumentList @(
  "--remote-debugging-port=$port",
  "--user-data-dir=$userDataDir",
  $url
)

Write-Host 'Keynu Chrome started safely.'
Write-Host 'Important: normal Chrome was NOT killed.'
Write-Host "Profile: $userDataDir"
