$ErrorActionPreference = 'Stop'

function Show-WeeCheckStartError([string]$Detail) {
  try {
    Add-Type -AssemblyName PresentationFramework
    $title = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('V2VlIENoZWNrIEFQIOyLpO2WiSDsmKTrpZg='))
    $summary = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('V2VlIENoZWNrIEFQ66W8IOyLnOyeke2VmOyngCDrqrvtlojsirXri4jri6Qu'))
    $help = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('7JWE656YIOuCtOyaqeydhCDqtIDrpqzsnpDsl5Dqsowg7KCE64us7ZW0IOyjvOyEuOyalC4='))
    [void][System.Windows.MessageBox]::Show("$summary`r`n`r`n$Detail`r`n`r`n$help",$title,[System.Windows.MessageBoxButton]::OK,[System.Windows.MessageBoxImage]::Error)
  } catch { }
}

trap {
  Show-WeeCheckStartError $_.Exception.Message
  exit 1
}

$project = Split-Path -Parent $PSScriptRoot
$bundledNode = Join-Path $project 'runtime\node.exe'
$node = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node -ErrorAction Stop).Source }
$server = Join-Path $project 'server-dist\server\index.js'
if (-not (Test-Path -LiteralPath $server)) { throw 'Run npm run build first.' }
$dataDirectory = if ($env:WEE_CHECK_DATA_DIR) { $env:WEE_CHECK_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'WeeCheckAP' }
$pidFile = Join-Path $dataDirectory 'wee-check.pid'
$adminPort = if ($env:WEE_CHECK_ADMIN_PORT) { $env:WEE_CHECK_ADMIN_PORT } else { '4173' }
$studentPort = if ($env:WEE_CHECK_STUDENT_PORT) { $env:WEE_CHECK_STUDENT_PORT } else { '4174' }
$adminUrl = "http://127.0.0.1:$adminPort/admin"
$healthUrl = "http://127.0.0.1:$adminPort/healthz"
$firewallScript = Join-Path $PSScriptRoot 'configure-windows-firewall.ps1'

if (Test-Path -LiteralPath $firewallScript) {
  & $firewallScript -Port ([int]$studentPort) -ProgramPath $node
}

function Get-WeeCheckHealth {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
    if ($health.service -eq 'wee-check-ap' -and $health.ok) { return $health }
  } catch { }
  return $null
}

function Stop-WeeCheckProcessTree([int]$ProcessId) {
  & "$env:SystemRoot\System32\taskkill.exe" /PID $ProcessId /T /F 2>$null | Out-Null
}

$health = Get-WeeCheckHealth
if ($health) {
  New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
  Set-Content -LiteralPath $pidFile -Value ([string]$health.pid) -Encoding ascii
  Start-Process $adminUrl
  exit 0
}

if (Test-Path -LiteralPath $pidFile) {
  $savedPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($savedPid -match '^\d+$') {
    $savedProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
    if ($savedProcess -and $savedProcess.CommandLine -like "*$server*") {
      Stop-WeeCheckProcessTree ([int]$savedPid)
      Start-Sleep -Milliseconds 500
    }
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

$listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $adminPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  throw "Port $adminPort is already used by another program (PID $($listener.OwningProcess)). Close that program and start Wee Check again."
}

New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
$env:NODE_ENV = 'production'
$process = $null
try {
  $process = Start-Process -FilePath $node -ArgumentList ('"' + $server + '"') -WorkingDirectory $project -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) { throw 'Wee Check server stopped before startup completed.' }
    $health = Get-WeeCheckHealth
    if ($health -and [int]$health.pid -eq $process.Id) { $ready = $true; break }
  }
  if (-not $ready) { throw 'Wee Check administrator server did not start within 15 seconds.' }
} catch {
  if ($process -and -not $process.HasExited) { Stop-WeeCheckProcessTree $process.Id }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  throw
}
Start-Process $adminUrl
