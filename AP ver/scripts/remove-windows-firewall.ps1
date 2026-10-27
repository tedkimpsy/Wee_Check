param(
  [int]$Port = 4174,
  [switch]$NoElevation
)

$ErrorActionPreference = 'Stop'
$ruleName = "Wee Check AP - Student TCP $Port"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdministrator) {
  if ($NoElevation) { throw 'Administrator privileges are required to remove the Windows Firewall rule.' }
  try {
    Add-Type -AssemblyName PresentationFramework
    $dialogTitle = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('V2VlIENoZWNrIEFQIOygnOqxsA=='))
    $dialogMessage = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('V2VlIENoZWNrIEFQIOyghOyaqSBXaW5kb3dzIOuwqe2ZlOuyvSDqt5zsuZnsnYQg7KCc6rGw7ZWY6riwIOychO2VtCDqtIDrpqzsnpAg6raM7ZWcIO2ZleyduOydtCDtlYTsmpTtlanri4jri6Qu'))
    [void][System.Windows.MessageBox]::Show($dialogMessage,$dialogTitle,[System.Windows.MessageBoxButton]::OK,[System.Windows.MessageBoxImage]::Information)
  } catch { }
  $powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',('"{0}"' -f $PSCommandPath),'-Port',[string]$Port,'-NoElevation')
  $elevated = Start-Process -FilePath $powerShell -Verb RunAs -ArgumentList $arguments -Wait -PassThru
  if ($elevated.ExitCode -ne 0) { throw 'Could not remove the Windows Firewall rule.' }
  exit 0
}

Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host "Windows Firewall inbound rule removed: $ruleName"
