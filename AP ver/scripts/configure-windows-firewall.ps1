param(
  [int]$Port = 4174,
  [string]$ProgramPath = '',
  [switch]$NoElevation
)

$ErrorActionPreference = 'Stop'
$ruleName = "Wee Check AP - Student TCP $Port"
$resolvedProgram = $ProgramPath
if ([string]::IsNullOrWhiteSpace($resolvedProgram)) {
  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $nodeCommand) { $nodeCommand = Get-Command node -ErrorAction Stop }
  $resolvedProgram = $nodeCommand.Source
}
$resolvedProgram = [IO.Path]::GetFullPath($resolvedProgram)
if (-not (Test-Path -LiteralPath $resolvedProgram -PathType Leaf)) {
  throw "The Wee Check AP runtime was not found: $resolvedProgram"
}

$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Select-Object -First 1
$existingApplication = if ($existingRule) { $existingRule | Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
$existingPort = if ($existingRule) { $existingRule | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
$existingAddress = if ($existingRule) { $existingRule | Get-NetFirewallAddressFilter -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
$applicationMatches = $false
if ($existingApplication -and $existingApplication.Program -and $existingApplication.Program -ne 'Any') {
  try { $applicationMatches = [IO.Path]::GetFullPath([string]$existingApplication.Program) -eq $resolvedProgram } catch { $applicationMatches = $false }
}
$portMatches = $existingPort -and $existingPort.Protocol -eq 'TCP' -and [string]$existingPort.LocalPort -eq [string]$Port
$addressMatches = $existingAddress -and @($existingAddress.RemoteAddress) -contains 'LocalSubnet'
if ($existingRule -and $existingRule.Enabled -eq 'True' -and $existingRule.Direction -eq 'Inbound' -and $existingRule.Action -eq 'Allow' -and $existingRule.Profile -eq 'Any' -and $applicationMatches -and $portMatches -and $addressMatches) {
  Write-Host "Windows Firewall rule is already configured: $resolvedProgram / TCP $Port / Any profile / LocalSubnet"
  exit 0
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdministrator) {
  if ($NoElevation) { throw 'Administrator privileges are required to configure Windows Firewall.' }
  try {
    Add-Type -AssemblyName PresentationFramework
    $dialogTitle = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('V2VlIENoZWNrIEFQIOuEpO2KuOybjO2BrCDshKTsoJU='))
    $dialogMessage = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('V2VlIENoZWNrIEFQ6rCAIOqwmeydgCDtlZnqtZAgV2ktRmnsnZgg7ZWZ7IOdIOq4sOq4sOyZgCDthrXsi6DtlaAg7IiYIOyeiOuPhOuhnSBXaW5kb3dzIOuwqe2ZlOuyvSDqt5zsuZnsnYQg7ISk7KCV7ZWp64uI64ukLg0KDQrtl4jsmqkg67KU7JyEOiBUQ1AgNDE3NCAvIO2YhOyerCDroZzsu6wg7ISc67iM64S3DQrsnbjthLDrhLfsnbTrgpgg7Jm467aAIOyEnOuyhOyXkOuKlCDtj6ztirjrpbwg6rO16rCc7ZWY7KeAIOyViuyKteuLiOuLpC4NCu2VmeyDnSDsoJXrs7TripQg7J20IFBD7J2YIOyVlO2YuO2ZlOuQnCDroZzsu6wg642w7J207YSw67Kg7J207Iqk7JeQ66eMIOyggOyepeuQqeuLiOuLpC4NCg0K6rOE7IaN7ZWY66m0IFdpbmRvd3Mg6rSA66as7J6QIOq2jO2VnCDtmZXsnbgg7LC97J20IOuCmO2DgOuCqeuLiOuLpC4='))
    [void][System.Windows.MessageBox]::Show($dialogMessage,$dialogTitle,[System.Windows.MessageBoxButton]::OK,[System.Windows.MessageBoxImage]::Information)
  } catch {
    Write-Host 'Wee Check AP needs administrator approval to allow student devices on the same local subnet to use TCP port 4174.'
  }
  $powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', ('"{0}"' -f $PSCommandPath),
    '-Port', [string]$Port,
    '-ProgramPath', ('"{0}"' -f $resolvedProgram),
    '-NoElevation'
  )
  $elevated = Start-Process -FilePath $powerShell -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  if ($elevated.ExitCode -ne 0) { throw 'Could not configure the Windows Firewall rule.' }
  exit 0
}

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule `
  -DisplayName $ruleName `
  -Description 'Allows student devices on the same secure AP to access the Wee Check AP student server.' `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $Port `
  -Program $resolvedProgram `
  -Profile Any `
  -RemoteAddress LocalSubnet | Out-Null

Write-Host "Windows Firewall inbound rule configured: $resolvedProgram / TCP $Port / Any profile / LocalSubnet"
