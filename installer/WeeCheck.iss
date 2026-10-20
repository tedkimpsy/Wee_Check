#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#define MyAppName "Wee Check"
#define MyAppPublisher "김한석"
#define MyAppURL "https://github.com/tedkimpsy/Wee_Check"
#define MyAppExeName "runtime\node.exe"

[Setup]
AppId={{A0D31803-6A36-45E4-8CC5-715C485803CB}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL=mailto:tedkim.psy@gmail.com
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\WeeCheck
DefaultGroupName=Wee Check
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=WeeCheck-Setup-{#MyAppVersion}
SetupIconFile=..\assets\WeeCheck.ico
UninstallDisplayIcon={app}\assets\WeeCheck.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=Wee Check Windows Installer
VersionInfoCopyright=Copyright (C) 2026 김한석. All rights reserved.

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
Source: "..\release\Wee-Check-Windows\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Wee Check"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-we-check.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\WeeCheck.ico"; Comment: "Wee Check 관리자 실행"
Name: "{autodesktop}\Wee Check"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-we-check.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\WeeCheck.ico"; Comment: "Wee Check 관리자 실행"
Name: "{autoprograms}\Wee Check 종료"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\stop-we-check.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\WeeCheck.ico"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-we-check.ps1"""; Description: "Wee Check 실행"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\stop-we-check.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopWeeCheck"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
