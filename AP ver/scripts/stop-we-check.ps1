$ErrorActionPreference = 'Stop'

function Show-WeeCheckStopError([string]$Detail) {
  try {
    Add-Type -AssemblyName PresentationFramework
    $title = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('V2VlIENoZWNrIEFQIOyiheujjCDsmKTrpZg='))
    $summary = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('V2VlIENoZWNrIEFQ66W8IOyZhOyghO2eiCDsooXro4ztlZjsp4Ag66q77ZaI7Iq164uI64ukLg=='))
    $help = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('7JWE656YIOuCtOyaqeydhCDqtIDrpqzsnpDsl5Dqsowg7KCE64us7ZW0IOyjvOyEuOyalC4='))
    [void][System.Windows.MessageBox]::Show("$summary`r`n`r`n$Detail`r`n`r`n$help",$title,[System.Windows.MessageBoxButton]::OK,[System.Windows.MessageBoxImage]::Error)
  } catch { }
}

trap {
  Show-WeeCheckStopError $_.Exception.Message
  exit 1
}

$project = Split-Path -Parent $PSScriptRoot
$server = Join-Path $project 'server-dist\server\index.js'
$dataDirectory = if ($env:WEE_CHECK_DATA_DIR) { $env:WEE_CHECK_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'WeeCheckAP' }
$pidFile = Join-Path $dataDirectory 'wee-check.pid'
$devStateFile = Join-Path $dataDirectory 'wee-check-dev.json'
$adminPort = if ($env:WEE_CHECK_ADMIN_PORT) { $env:WEE_CHECK_ADMIN_PORT } else { '4173' }
$studentPort = if ($env:WEE_CHECK_STUDENT_PORT) { $env:WEE_CHECK_STUDENT_PORT } else { '4174' }
$webPort = 5173
$healthUrl = "http://127.0.0.1:$adminPort/healthz"

function Stop-WeeCheckProcessTree([int]$ProcessId) {
  & "$env:SystemRoot\System32\taskkill.exe" /PID $ProcessId /T /F 2>$null | Out-Null
}

function Test-WeeCheckDevelopmentProcess($Process) {
  if (-not $Process -or -not $Process.CommandLine) { return $false }
  return $Process.CommandLine.IndexOf($project, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

$processIds = [Collections.Generic.HashSet[int]]::new()

if (Test-Path -LiteralPath $pidFile) {
  $savedPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($savedPid -match '^\d+$') {
    $owned = $false
    try {
      $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 1
      $owned = $health.service -eq 'wee-check-ap' -and [int]$health.pid -eq [int]$savedPid
    } catch { }
    if (-not $owned) {
      $savedProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $savedPid" -ErrorAction SilentlyContinue
      $owned = $savedProcess -and $savedProcess.CommandLine -like "*$server*"
    }
    if ($owned) { [void]$processIds.Add([int]$savedPid) }
  }
}

if (Test-Path -LiteralPath $devStateFile) {
  try {
    $state = Get-Content -LiteralPath $devStateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([IO.Path]::GetFullPath([string]$state.projectRoot) -eq [IO.Path]::GetFullPath($project)) {
      foreach ($candidateId in @($state.pids)) {
        if ([string]$candidateId -notmatch '^\d+$') { continue }
        $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $candidateId" -ErrorAction SilentlyContinue
        if (Test-WeeCheckDevelopmentProcess $candidate) { [void]$processIds.Add([int]$candidateId) }
      }
    }
  } catch { }
}

$ports = @([int]$adminPort, [int]$studentPort, [int]$webPort)
$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains [int]$_.LocalPort }
foreach ($listener in $listeners) {
  $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
  if (Test-WeeCheckDevelopmentProcess $candidate) { [void]$processIds.Add([int]$listener.OwningProcess) }
}

foreach ($processId in $processIds) {
  Stop-WeeCheckProcessTree $processId
}

foreach ($processId in $processIds) {
  for ($attempt = 0; $attempt -lt 50; $attempt++) {
    if (-not (Get-Process -Id $processId -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 100
  }
}
$remainingOwnedListeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains [int]$_.LocalPort } | Where-Object {
  $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" -ErrorAction SilentlyContinue
  Test-WeeCheckDevelopmentProcess $candidate
})
if ($remainingOwnedListeners.Count -gt 0) {
  $openPorts = ($remainingOwnedListeners.LocalPort | Sort-Object -Unique) -join ', '
  throw "Wee Check AP did not release TCP port(s): $openPorts"
}
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $devStateFile -Force -ErrorAction SilentlyContinue
Write-Host 'Wee Check AP stopped. TCP listeners 4173, 4174 and 5173 are closed.'
