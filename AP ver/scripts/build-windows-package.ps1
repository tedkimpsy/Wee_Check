param(
  [string]$OutputDirectory = '',
  [string]$NodeSource = ''
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

Write-Host '1/6 Building the application.'
$serverBuild = Join-Path $project 'server-dist'
if (Test-Path -LiteralPath $serverBuild) {
  Remove-Item -LiteralPath $serverBuild -Recurse -Force
}
Push-Location $project
try {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) { $npm = Get-Command npm -ErrorAction Stop }
  & $npm.Source run build
  if ($LASTEXITCODE -ne 0) { throw 'Application build failed.' }
} finally {
  Pop-Location
}

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Recurse -Force
}
New-Item -ItemType Directory -Path $output | Out-Null
New-Item -ItemType Directory -Path (Join-Path $output 'runtime') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $output 'assets') | Out-Null
New-Item -ItemType Directory -Path (Join-Path $output 'scripts') | Out-Null

Write-Host '2/6 Copying application files.'
Copy-Item -LiteralPath (Join-Path $project 'dist') -Destination $output -Recurse
Copy-Item -LiteralPath (Join-Path $project 'server-dist') -Destination $output -Recurse
Copy-Item -LiteralPath (Join-Path $project 'package.json') -Destination $output
Copy-Item -LiteralPath (Join-Path $project 'package-lock.json') -Destination $output
Copy-Item -LiteralPath (Join-Path $project 'README.md') -Destination $output
Copy-Item -LiteralPath (Join-Path $project 'scripts\start-we-check.ps1') -Destination (Join-Path $output 'scripts')
Copy-Item -LiteralPath (Join-Path $project 'scripts\stop-we-check.ps1') -Destination (Join-Path $output 'scripts')
Copy-Item -LiteralPath (Join-Path $project 'scripts\configure-windows-firewall.ps1') -Destination (Join-Path $output 'scripts')
Copy-Item -LiteralPath (Join-Path $project 'scripts\remove-windows-firewall.ps1') -Destination (Join-Path $output 'scripts')
Copy-Item -LiteralPath (Join-Path $project 'assets\WeeCheck.ico') -Destination (Join-Path $output 'assets')

Write-Host '3/6 Preparing secure-AP local network setup.'

Write-Host '4/6 Bundling Node.js runtime.'
$nodeCandidates = @()
if (-not [string]::IsNullOrWhiteSpace($NodeSource)) { $nodeCandidates += $NodeSource }
if (-not [string]::IsNullOrWhiteSpace($env:WEE_CHECK_NODE_SOURCE)) { $nodeCandidates += $env:WEE_CHECK_NODE_SOURCE }
$installedNode = Get-Command node.exe -ErrorAction SilentlyContinue
if ($installedNode) { $nodeCandidates += $installedNode.Source }
$nodeSourcePath = $nodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $nodeSourcePath) { throw 'node.exe was not found. Install Node.js 20 or later, or pass -NodeSource.' }
$bundledNode = Join-Path $output 'runtime\node.exe'
Copy-Item -LiteralPath $nodeSourcePath -Destination $bundledNode
$nodeVersion = & $bundledNode --version
if ($LASTEXITCODE -ne 0) { throw 'Bundled node.exe validation failed.' }
$nodeMajor = [int]([regex]::Match($nodeVersion, '^v(\d+)').Groups[1].Value)
if ($nodeMajor -lt 20) { throw "Node.js 20 or later is required. Found: $nodeVersion" }
Write-Host "Bundled: Node.js $nodeVersion"

Write-Host '5/6 Bundling verified Node.js runtime dependencies.'
$sourceModules = Join-Path $project 'node_modules'
if (-not (Test-Path -LiteralPath (Join-Path $sourceModules 'fastify\package.json'))) {
  $sourceModules = Join-Path (Split-Path -Parent $project) 'node_modules'
}
if (-not (Test-Path -LiteralPath (Join-Path $sourceModules 'fastify\package.json'))) {
  throw 'Verified node_modules are missing. Install dependencies in AP ver or its parent project first.'
}
Copy-Item -LiteralPath $sourceModules -Destination $output -Recurse
Push-Location $output
try {
  & $npm.Source prune --omit=dev --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw 'Removing development-only dependencies failed.' }
} finally {
  Pop-Location
}
$viteCache = Join-Path $output 'node_modules\.vite'
if (Test-Path -LiteralPath $viteCache) {
  Remove-Item -LiteralPath $viteCache -Recurse -Force
}

Write-Host '6/6 Validating required deployment files.'
$required = @(
  'assets\WeeCheck.ico',
  'dist\index.html',
  'runtime\node.exe',
  'server-dist\server\index.js',
  'scripts\configure-windows-firewall.ps1',
  'scripts\remove-windows-firewall.ps1',
  'scripts\start-we-check.ps1',
  'scripts\stop-we-check.ps1',
  'node_modules\fastify\package.json'
)
foreach ($relative in $required) {
  $requiredPath = Join-Path $output $relative
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Required deployment file is missing: $relative" }
}

$manifest = [ordered]@{
  application = 'Wee Check AP'
  packagedAt = (Get-Date).ToUniversalTime().ToString('o')
  networkMode = 'private-lan-only'
  node = $nodeVersion
  studentFirewallScope = 'BundledNodeOnly/AnyProfile/LocalSubnet'
  includesNodeRuntime = $true
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'deployment-manifest.json') -Encoding utf8
Write-Host "Deployment package created: $output"
