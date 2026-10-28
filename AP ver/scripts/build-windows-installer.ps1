param(
  [string]$InnoSetupCompiler = '',
  [string]$NodeSource = ''
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$packageScript = Join-Path $PSScriptRoot 'build-windows-package.ps1'
$definition = Join-Path $project 'installer\WeeCheck.iss'
$package = Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version

try {
  & $packageScript -NodeSource $NodeSource
  if ($LASTEXITCODE -ne 0) { throw 'Windows package build failed.' }

  $candidates = @()
  if ($InnoSetupCompiler) { $candidates += $InnoSetupCompiler }
  if ($env:WEE_CHECK_ISCC_PATH) { $candidates += $env:WEE_CHECK_ISCC_PATH }
  $candidates += "$env:ProgramFiles\Inno Setup 7\ISCC.exe"
  $candidates += "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe"
  $candidates += "$env:LOCALAPPDATA\Programs\Inno Setup 7\ISCC.exe"
  $found = Get-Command ISCC.exe -ErrorAction SilentlyContinue
  if ($found) { $candidates += $found.Source }
  $compiler = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if (-not $compiler) { throw 'Inno Setup 7 was not found. Install the recommended 64-bit edition with: winget install --id JRSoftware.InnoSetup.7 -e -s winget -i' }
  $compilerVersion = (& $compiler '--version' 2>&1 | Select-Object -First 1).ToString().Trim()
  if ($LASTEXITCODE -ne 0 -or $compilerVersion -notmatch '^(\d+)') {
    throw "Unable to determine the Inno Setup compiler version at $compiler"
  }
  $compilerMajor = [int]$Matches[1]
  if ($compilerMajor -lt 7) { throw "Inno Setup 7 or later is required. Found: $compilerVersion at $compiler" }

  & $compiler '/Qp' "/DMyAppVersion=$version" $definition
  if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }

  $installer = Join-Path $project "release\WeeCheck-AP-Setup-$version.exe"
  if (-not (Test-Path -LiteralPath $installer)) { throw "Installer was not created: $installer" }
  Write-Host "Windows installer created: $installer"
} finally {
}
