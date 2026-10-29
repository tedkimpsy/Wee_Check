using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

// A launcher, not an installer: no uninstall registration, shortcuts or autorun.
internal static class PortableLauncher
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--verify-payload")
        {
            try
            {
                using (var stream = Payload())
                using (var zip = new ZipArchive(stream, ZipArchiveMode.Read))
                    foreach (var name in new[] { "runtime/node.exe", "server-dist/server/index.js", "scripts/start-we-check.ps1", "scripts/stop-we-check.ps1" })
                        if (zip.GetEntry(name) == null && zip.GetEntry(name.Replace('/', '\\')) == null) return 2;
                return 0;
            }
            catch { return 3; }
        }
        bool first;
        using (var mutex = new Mutex(true, "Local\\WeeCheckAPPortableLauncher", out first))
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            if (!first)
            {
                MessageBox.Show("이미 실행 중입니다. 작업 표시줄 알림 영역의 Wee Check 아이콘에서 관리자 화면을 열어 주세요.", "Wee Check AP");
                return 0;
            }
            Application.Run(new LauncherForm());
        }
        return 0;
    }

    internal static Stream Payload()
    {
        return Assembly.GetExecutingAssembly().GetManifestResourceStream("WeeCheck.Payload.zip");
    }

    internal static string Prepare()
    {
        string hash;
        using (var sha = SHA256.Create())
        using (var payload = Payload()) hash = BitConverter.ToString(sha.ComputeHash(payload)).Replace("-", "").Substring(0, 16);
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WeeCheckAPPortableCache", hash);
        var marker = Path.Combine(root, ".ready");
        if (!File.Exists(marker))
        {
            Directory.CreateDirectory(root);
            using (var payload = Payload())
            using (var zip = new ZipArchive(payload, ZipArchiveMode.Read))
                foreach (var entry in zip.Entries)
                {
                    var destination = Path.GetFullPath(Path.Combine(root, entry.FullName.Replace('/', Path.DirectorySeparatorChar)));
                    if (!destination.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("Invalid package path.");
                    if (entry.Name.Length == 0) { Directory.CreateDirectory(destination); continue; }
                    Directory.CreateDirectory(Path.GetDirectoryName(destination));
                    using (var input = entry.Open())
                    using (var output = File.Create(destination)) input.CopyTo(output);
                }
            File.WriteAllText(marker, hash);
        }
        return root;
    }
}

internal sealed class LauncherForm : Form
{
    private readonly Label status = new Label { Dock = DockStyle.Top, Height = 90, Padding = new Padding(16), Text = "실행에 필요한 파일을 준비하고 있습니다. 처음 실행할 때는 잠시 걸릴 수 있습니다." };
    private readonly Button open = new Button { Text = "관리자 화면 열기", Width = 160, Enabled = false };
    private readonly Button stop = new Button { Text = "종료", Width = 100, Enabled = false };
    private readonly NotifyIcon tray;
    private string root;
    private bool busy = true;
    private bool quitting;

    internal LauncherForm()
    {
        Text = "Wee Check AP 포터블";
        ClientSize = new Size(460, 165);
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 55, Padding = new Padding(12) };
        buttons.Controls.Add(open); buttons.Controls.Add(stop);
        Controls.Add(status); Controls.Add(buttons);
        tray = new NotifyIcon { Icon = Icon, Text = "Wee Check AP 포터블", Visible = true };
        var menu = new ContextMenuStrip();
        menu.Items.Add("실행 창 열기", null, delegate { Show(); WindowState = FormWindowState.Normal; Activate(); });
        menu.Items.Add("종료", null, async delegate { await Quit(); });
        tray.ContextMenuStrip = menu;
        tray.DoubleClick += delegate { Show(); Activate(); };
        open.Click += delegate { Process.Start("http://127.0.0.1:4173/admin"); };
        stop.Click += async delegate { await Quit(); };
        Shown += async delegate
        {
            try
            {
                root = await Task.Run(() => PortableLauncher.Prepare());
                status.Text = "학생 접속을 준비합니다. 처음 실행 시 방화벽 안내와 Windows 관리자 권한 확인이 나타날 수 있습니다.";
                await Task.Run(() => RunScript("start-we-check.ps1"));
                busy = false; open.Enabled = stop.Enabled = true;
                status.Text = "실행 중입니다. 이 창을 닫으면 알림 영역에 남습니다. 사용을 마치면 반드시 '종료'를 눌러 주세요.\r\nWindows를 다시 시작하면 포터블 EXE를 직접 실행하세요.";
            }
            catch (Exception ex)
            {
                MessageBox.Show("시작하지 못했습니다.\r\n" + ex.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                quitting = true; Close();
            }
        };
        FormClosing += delegate(object sender, FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.WindowsShutDown || e.CloseReason == CloseReason.TaskManagerClosing) return;
            if (!quitting) { e.Cancel = true; if (!busy) Hide(); }
        };
        FormClosed += delegate { tray.Dispose(); };
    }

    private void RunScript(string name)
    {
        var ps = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell", "v1.0", "powershell.exe");
        using (var process = Process.Start(new ProcessStartInfo(ps, "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + Path.Combine(root, "scripts", name) + "\"") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root }))
        {
            process.WaitForExit();
            if (process.ExitCode != 0) throw new IOException("실행 또는 종료 작업을 완료하지 못했습니다. 안내창의 내용을 확인해 주세요.");
        }
    }

    private async Task Quit()
    {
        if (busy) return;
        busy = true; stop.Enabled = open.Enabled = false; Show(); status.Text = "학생 접속과 프로그램을 종료하고 있습니다...";
        try
        {
            await Task.Run(() => RunScript("stop-we-check.ps1"));
            quitting = true; Close();
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
            busy = false; stop.Enabled = open.Enabled = true;
        }
    }
}
