$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$server = Join-Path $project 'server-dist\server\index.js'
if (-not (Test-Path -LiteralPath $server)) { throw '먼저 npm run build를 실행해야 합니다.' }
Start-Process -FilePath $node -ArgumentList ('"' + $server + '"') -WorkingDirectory $project -WindowStyle Hidden
Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:4173/admin'
