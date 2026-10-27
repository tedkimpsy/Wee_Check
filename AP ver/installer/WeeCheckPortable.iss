#ifndef MyAppVersion
  #define MyAppVersion "0.1.1"
#endif
#define MyAppName "Wee Check AP Portable"
#define MyAppPublisher "김한석"
#define MyAppURL "https://github.com/tedkimpsy/Wee_Check"

[Setup]
AppId={{45C9DFE0-B0B5-47AE-8987-0FC736FCE871}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL=mailto:tedkim.psy@gmail.com
DefaultDirName={localappdata}\Programs\WeeCheckAPPortable\{#MyAppVersion}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=WeeCheck-AP-Portable-{#MyAppVersion}
SetupIconFile=..\assets\WeeCheck.ico
UninstallDisplayIcon={app}\assets\WeeCheck.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
InfoBeforeFile=firewall-info-ko.txt
Uninstallable=yes
CreateUninstallRegKey=yes
DisableWelcomePage=no
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=no
DisableFinishedPage=no
DisableStartupPrompt=yes
CloseApplications=no
RestartApplications=no
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=Wee Check Portable Launcher
VersionInfoCopyright=Copyright (C) 2026 김한석. All rights reserved.

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
Source: "..\release\Wee-Check-Windows\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-we-check.ps1"""; WorkingDir: "{app}"; Flags: nowait runhidden; Check: ShouldLaunch

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\stop-we-check.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopWeeCheckAPPortable"
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\remove-windows-firewall.ps1"" -Port 4174"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveWeeCheckAPPortableFirewall"

[Code]
var
  FirewallReady: Boolean;

function HasCommandLineParam(Value: String): Boolean;
var
  Index: Integer;
begin
  Result := False;
  for Index := 1 to ParamCount do
  begin
    if CompareText(ParamStr(Index), Value) = 0 then
    begin
      Result := True;
      Exit;
    end;
  end;
end;

function ShouldLaunch(): Boolean;
begin
  Result := (not HasCommandLineParam('/NOLAUNCH')) and FirewallReady;
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
      '학생 기기 접속을 위한 방화벽 설정이 완료되지 않았습니다. 다시 시도하시겠습니까?',
      mbError,
      MB_RETRYCANCEL
    );
  until RetryResult <> IDRETRY;
end;

function ExistingServerIsRunning(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(
    ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -Command "$ProgressPreference=''SilentlyContinue''; try { $health=Invoke-RestMethod -TimeoutSec 1 -Uri ''http://127.0.0.1:4173/healthz''; if ($health.ok -and $health.service -eq ''wee-check-ap'') { exit 0 } } catch {}; exit 1"',
    '',
    SW_HIDE,
    ewWaitUntilTerminated,
    ResultCode
  ) and (ResultCode = 0);
end;

function InitializeSetup(): Boolean;
var
  ErrorCode: Integer;
begin
  if ExistingServerIsRunning() then
  begin
    ShellExec('', 'http://127.0.0.1:4173/admin', '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode);
    Result := False;
  end
  else
    Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and (not HasCommandLineParam('/NOLAUNCH')) then
  begin
    FirewallReady := ConfigureFirewall();
    if not FirewallReady then
      MsgBox(
        '파일 준비는 완료되었지만 방화벽 설정이 완료되지 않아 Wee Check AP를 시작하지 않습니다.' + #13#10 +
        '다시 실행하면 설정을 재시도할 수 있습니다.',
        mbInformation,
        MB_OK
      );
  end;
end;
