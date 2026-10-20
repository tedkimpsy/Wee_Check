param(
  [string]$InnoSetupCompiler = '',
  [string]$CloudflaredSource = '',
  [string]$NodeSource = ''
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$packageScript = Join-Path $PSScriptRoot 'build-windows-package.ps1'
$definition = Join-Path $project 'installer\WeeCheck.iss'
$package = Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version

if (-not $CloudflaredSource) {
  $previousBundle = Join-Path $project 'release\Wee-Check-Windows\bin\cloudflared.exe'
  if (Test-Path -LiteralPath $previousBundle) {
    $temporaryCloudflared = Join-Path ([System.IO.Path]::GetTempPath()) "wee-check-cloudflared-$PID.exe"
    Copy-Item -LiteralPath $previousBundle -Destination $temporaryCloudflared -Force
    $CloudflaredSource = $temporaryCloudflared
  }
}

try {
  & $packageScript -CloudflaredSource $CloudflaredSource -NodeSource $NodeSource
  if ($LASTEXITCODE -ne 0) { throw 'Windows package build failed.' }

  $candidates = @()
  if ($InnoSetupCompiler) { $candidates += $InnoSetupCompiler }
  if ($env:WEE_CHECK_ISCC_PATH) { $candidates += $env:WEE_CHECK_ISCC_PATH }
  $found = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($found) { $candidates += $found.Source }
  $candidates += "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
  $candidates += "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
  $compiler = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $compiler) { throw 'Inno Setup 6 was not found. Install it with: winget install --id JRSoftware.InnoSetup --exact' }

  & $compiler '/Qp' "/DMyAppVersion=$version" $definition
  if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }

  $installer = Join-Path $project "release\WeeCheck-Setup-$version.exe"
  if (-not (Test-Path -LiteralPath $installer)) { throw "Installer was not created: $installer" }
  Write-Host "Windows installer created: $installer"
} finally {
  if ($temporaryCloudflared -and (Test-Path -LiteralPath $temporaryCloudflared)) {
    Remove-Item -LiteralPath $temporaryCloudflared -Force
  }
}
