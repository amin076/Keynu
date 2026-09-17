param([Parameter(Mandatory=$true)][string]$ArgumentsFile)
$ErrorActionPreference = 'Stop'
$taskArguments = Get-Content -LiteralPath $ArgumentsFile -Raw | ConvertFrom-Json
@{ message = $taskArguments.message; count = $taskArguments.count } | ConvertTo-Json -Compress
