param(
  [string]$NodeSource = ''
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$version = [string](Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
& (Join-Path $PSScriptRoot 'build-windows-package.ps1') -NodeSource $NodeSource
if ($LASTEXITCODE -ne 0) { throw 'Windows portable package build failed.' }
$packageDirectory = Join-Path $project 'release\Wee-Check-Windows'
Copy-Item -LiteralPath (Join-Path $project 'assets\WeeCheck-Start.vbs') -Destination $packageDirectory
Copy-Item -LiteralPath (Join-Path $project 'assets\WeeCheck-Stop.vbs') -Destination $packageDirectory
Copy-Item -LiteralPath (Join-Path $project 'assets\portable-guide.txt') -Destination (Join-Path $packageDirectory 'START-HERE.txt')
$archive = Join-Path $project "release\WeeCheck-AP-Portable-$version.zip"
Compress-Archive -Path $packageDirectory -DestinationPath $archive -Force
if (-not (Test-Path -LiteralPath $archive)) { throw 'Portable archive was not created.' }
Write-Host "Portable ZIP created: $archive"
