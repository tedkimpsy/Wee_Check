$ErrorActionPreference = 'Stop'
$dataDirectory = Join-Path $env:LOCALAPPDATA 'WeeCheck'
$pidFile = Join-Path $dataDirectory 'wee-check.pid'

if (-not (Test-Path -LiteralPath $pidFile)) { exit 0 }
$savedPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
if ($savedPid) {
  $process = Get-Process -Id $savedPid -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
    $process.WaitForExit(5000)
  }
}
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
