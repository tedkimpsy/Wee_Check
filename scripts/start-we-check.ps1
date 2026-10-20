$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$bundledNode = Join-Path $project 'runtime\node.exe'
$node = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node -ErrorAction Stop).Source }
$server = Join-Path $project 'server-dist\server\index.js'
if (-not (Test-Path -LiteralPath $server)) { throw 'Run npm run build first.' }
$bundledCloudflared = Join-Path $project 'bin\cloudflared.exe'
if (-not (Test-Path -LiteralPath $bundledCloudflared)) { throw 'cloudflared.exe is missing. Rebuild with npm run package:windows.' }
$dataDirectory = Join-Path $env:LOCALAPPDATA 'WeeCheck'
$pidFile = Join-Path $dataDirectory 'wee-check.pid'
$adminPort = if ($env:WEE_CHECK_ADMIN_PORT) { $env:WEE_CHECK_ADMIN_PORT } else { '4173' }
$adminUrl = "http://127.0.0.1:$adminPort/admin"

if (Test-Path -LiteralPath $pidFile) {
  $savedPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($savedPid -and (Get-Process -Id $savedPid -ErrorAction SilentlyContinue)) {
    Start-Process $adminUrl
    exit 0
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

$listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $adminPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  Start-Process $adminUrl
  exit 0
}

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
$env:NODE_ENV = 'production'
$process = Start-Process -FilePath $node -ArgumentList ('"' + $server + '"') -WorkingDirectory $project -WindowStyle Hidden -PassThru
Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 500
  if ($process.HasExited) { throw 'Wee Check server stopped before startup completed.' }
  try {
    $response = Invoke-WebRequest -Uri $adminUrl -UseBasicParsing -TimeoutSec 1
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}
if (-not $ready) { throw 'Wee Check administrator page did not start within 15 seconds.' }
Start-Process $adminUrl
