$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'start-we-check.ps1'
$action = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $launcher + '"'
schtasks.exe /Create /TN 'Wee Check Local Server' /SC ONLOGON /TR $action /F | Out-Null
Write-Host 'Windows 로그인 시 Wee Check가 자동 시작되도록 등록했습니다.'
