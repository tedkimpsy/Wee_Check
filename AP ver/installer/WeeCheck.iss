#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif
#define MyAppName "Wee Check AP"
#define MyAppPublisher "김한석"
#define MyAppURL "https://github.com/tedkimpsy/Wee_Check"
#define MyAppExeName "runtime\node.exe"

[Setup]
AppId={{DD85B5FC-E868-4C1E-B9D5-5AD8DB63D376}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL=mailto:tedkim.psy@gmail.com
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\WeeCheckAP
DefaultGroupName=Wee Check AP
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=WeeCheck-AP-Setup-{#MyAppVersion}
SetupIconFile=..\assets\WeeCheck.ico
UninstallDisplayIcon={app}\assets\WeeCheck.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
InfoBeforeFile=firewall-info-ko.txt
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
Name: "{autoprograms}\Wee Check AP"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-we-check.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\WeeCheck.ico"; Comment: "Wee Check AP 관리자 실행"
Name: "{autodesktop}\Wee Check AP"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-we-check.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\WeeCheck.ico"; Comment: "Wee Check AP 관리자 실행"
Name: "{autoprograms}\Wee Check AP 종료"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\stop-we-check.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\assets\WeeCheck.ico"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-we-check.ps1"""; Description: "Wee Check AP 실행"; Flags: nowait postinstall skipifsilent; Check: FirewallConfigured

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\stop-we-check.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopWeeCheck"
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\remove-windows-firewall.ps1"" -Port 4174"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveWeeCheckAPFirewall"

[Code]
var
  FirewallReady: Boolean;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

function FirewallConfigured(): Boolean;
begin
  Result := FirewallReady;
end;

function ConfigureFirewall(): Boolean;
var
  ResultCode: Integer;
  RetryResult: Integer;
begin
  Result := False;
  repeat
    WizardForm.StatusLabel.Caption := 'Windows에서 관리자 권한을 확인하면 방화벽 설정을 완료합니다...';
    if ShellExec(
      'runas',
      ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      ExpandConstant('-NoProfile -ExecutionPolicy Bypass -File "{app}\scripts\configure-windows-firewall.ps1" -Port 4174 -ProgramPath "{app}\runtime\node.exe" -NoElevation'),
      ExpandConstant('{app}'),
      SW_HIDE,
      ewWaitUntilTerminated,
      ResultCode
    ) and (ResultCode = 0) then
    begin
      Result := True;
      Exit;
    end;
    RetryResult := MsgBox(
      '방화벽 설정이 완료되지 않았습니다.' + #13#10 + #13#10 +
      '학생 기기 접속을 사용하려면 관리자 권한 확인이 필요합니다. 다시 시도하시겠습니까?',
      mbError,
      MB_RETRYCANCEL
    );
  until RetryResult <> IDRETRY;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    FirewallReady := ConfigureFirewall();
    if not FirewallReady then
      MsgBox(
        '프로그램 파일 설치는 완료되었지만 학생 기기 접속 설정은 완료되지 않았습니다.' + #13#10 + #13#10 +
        '바탕화면의 Wee Check AP를 다시 실행하면 방화벽 설정을 다시 안내합니다.',
        mbInformation,
        MB_OK
      );
  end;
end;
