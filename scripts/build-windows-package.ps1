param(
  [string]$OutputDirectory = '',
  [string]$CloudflaredSource = ''
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $project 'release\Wee-Check-Windows'
}
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $project 'release'))

if (-not $output.StartsWith($releaseRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "For safety, the output directory must be inside $releaseRoot."
}

Write-Host '1/5 Building the application.'
Push-Location $project
try {
  & npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }
} finally {
  Pop-Location
}

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Recurse -Force
}
New-Item -ItemType Directory -Path $output | Out-Null
New-Item -ItemType Directory -Path (Join-Path $output 'bin') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $output 'scripts') | Out-Null

Write-Host '2/5 Copying application files.'
Copy-Item -LiteralPath (Join-Path $project 'dist') -Destination $output -Recurse
Copy-Item -LiteralPath (Join-Path $project 'server-dist') -Destination $output -Recurse
Copy-Item -LiteralPath (Join-Path $project 'package.json') -Destination $output
Copy-Item -LiteralPath (Join-Path $project 'package-lock.json') -Destination $output
Copy-Item -LiteralPath (Join-Path $project 'README.md') -Destination $output
Copy-Item -LiteralPath (Join-Path $project 'scripts\start-we-check.ps1') -Destination (Join-Path $output 'scripts')

Write-Host '3/5 Bundling Cloudflare Tunnel.'
$candidates = @()
if (-not [string]::IsNullOrWhiteSpace($CloudflaredSource)) { $candidates += $CloudflaredSource }
if (-not [string]::IsNullOrWhiteSpace($env:WEE_CHECK_CLOUDFLARED_SOURCE)) { $candidates += $env:WEE_CHECK_CLOUDFLARED_SOURCE }
$localBundle = Join-Path $project 'bin\cloudflared.exe'
if (Test-Path -LiteralPath $localBundle) { $candidates += $localBundle }
$installed = Get-Command cloudflared.exe -ErrorAction SilentlyContinue
if ($installed) { $candidates += $installed.Source }

$source = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $source) {
  throw 'cloudflared.exe was not found. Run scripts\install-cloudflared.ps1 or pass -CloudflaredSource.'
}
$bundledCloudflared = Join-Path $output 'bin\cloudflared.exe'
Copy-Item -LiteralPath $source -Destination $bundledCloudflared
$version = & $bundledCloudflared --version
if ($LASTEXITCODE -ne 0) { throw 'Bundled cloudflared.exe validation failed.' }
Write-Host "Bundled: $version"

Write-Host '4/5 Bundling verified Node.js runtime dependencies.'
$sourceModules = Join-Path $project 'node_modules'
if (-not (Test-Path -LiteralPath (Join-Path $sourceModules 'fastify\package.json'))) {
  throw 'Verified node_modules are missing. Run npm install in the project first.'
}
Copy-Item -LiteralPath $sourceModules -Destination $output -Recurse

Write-Host '5/5 Validating required deployment files.'
$required = @(
  'bin\cloudflared.exe',
  'dist\index.html',
  'server-dist\server\index.js',
  'scripts\start-we-check.ps1',
  'node_modules\fastify\package.json'
)
foreach ($relative in $required) {
  $requiredPath = Join-Path $output $relative
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Required deployment file is missing: $relative" }
}

$manifest = [ordered]@{
  application = 'Wee Check'
  packagedAt = (Get-Date).ToUniversalTime().ToString('o')
  cloudflared = $version
  includesCloudflareTunnel = $true
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'deployment-manifest.json') -Encoding utf8
Write-Host "Deployment package created: $output"
