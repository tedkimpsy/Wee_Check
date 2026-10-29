param(
  [string]$NodeSource = ''
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$version = [string](Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
& (Join-Path $PSScriptRoot 'build-windows-package.ps1') -NodeSource $NodeSource
if ($LASTEXITCODE -ne 0) { throw 'Windows portable package build failed.' }
$packageDirectory = Join-Path $project 'release\Wee-Check-Windows'
$archive = Join-Path $project 'release\portable-payload.zip'
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($packageDirectory, $archive)
$compiler = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework C# compiler is missing.' }
$portable = Join-Path $project "release\WeeCheck-AP-Portable-$version.exe"
& $compiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$portable" "/win32icon:$project\assets\WeeCheck.ico" "/resource:$archive,WeeCheck.Payload.zip" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll (Join-Path $project 'installer\PortableLauncher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Portable launcher compilation failed.' }
$verification = Start-Process -FilePath $portable -ArgumentList '--verify-payload' -Wait -PassThru -WindowStyle Hidden
if ($verification.ExitCode -ne 0) { throw 'Portable EXE embedded payload validation failed.' }
Write-Host "Portable EXE created and validated: $portable"
