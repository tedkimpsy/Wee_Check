$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$server = Join-Path $project 'server-dist\server\index.js'
if (-not (Test-Path -LiteralPath $server)) { throw 'Run npm run build first.' }
$bundledCloudflared = Join-Path $project 'bin\cloudflared.exe'
if (-not (Test-Path -LiteralPath $bundledCloudflared)) { throw 'cloudflared.exe is missing. Rebuild with npm run package:windows.' }
$env:NODE_ENV = 'production'
Start-Process -FilePath $node -ArgumentList ('"' + $server + '"') -WorkingDirectory $project -WindowStyle Hidden
Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:4173/admin'
