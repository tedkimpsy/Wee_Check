param([string]$Output = '')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WeeCheckNativeIcon {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern bool DestroyIcon(IntPtr handle);
}
'@

$project = Split-Path -Parent $PSScriptRoot
if (-not $Output) { $Output = Join-Path $project 'assets\WeeCheck.ico' }
$directory = Split-Path -Parent $Output
New-Item -ItemType Directory -Path $directory -Force | Out-Null

$bitmap = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = 52
$bounds = New-Object System.Drawing.Rectangle 16, 16, 224, 224
$diameter = $radius * 2
$path.AddArc($bounds.Left, $bounds.Top, $diameter, $diameter, 180, 90)
$path.AddArc($bounds.Right - $diameter, $bounds.Top, $diameter, $diameter, 270, 90)
$path.AddArc($bounds.Right - $diameter, $bounds.Bottom - $diameter, $diameter, $diameter, 0, 90)
$path.AddArc($bounds.Left, $bounds.Bottom - $diameter, $diameter, $diameter, 90, 90)
$path.CloseFigure()

$background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 46, 197, 198))
$graphics.FillPath($background, $path)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White, 24)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawLines($pen, @(
  (New-Object System.Drawing.Point 66, 132),
  (New-Object System.Drawing.Point 111, 177),
  (New-Object System.Drawing.Point 193, 88)
))

$handle = $bitmap.GetHicon()
try {
  $icon = [System.Drawing.Icon]::FromHandle($handle)
  $stream = [System.IO.File]::Open($Output, [System.IO.FileMode]::Create)
  try { $icon.Save($stream) } finally { $stream.Dispose(); $icon.Dispose() }
} finally {
  [WeeCheckNativeIcon]::DestroyIcon($handle) | Out-Null
  $pen.Dispose()
  $background.Dispose()
  $path.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Host "Icon created: $Output"
