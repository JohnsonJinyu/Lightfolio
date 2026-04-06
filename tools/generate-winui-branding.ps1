param(
    [string]$AssetsDir = "winui/Lightfolio.WinUI/Assets",
    [string]$ElectronAssetsDir = "app/resources"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NativeIcon
{
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool DestroyIcon(IntPtr handle);
}
"@

function Get-Color {
    param(
        [Parameter(Mandatory = $true)][string]$Hex,
        [int]$Alpha = 255
    )

    $baseColor = [System.Drawing.ColorTranslator]::FromHtml($Hex)
    return [System.Drawing.Color]::FromArgb($Alpha, $baseColor.R, $baseColor.G, $baseColor.B)
}

function New-RoundedPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $diameter = [Math]::Min($Radius * 2, [Math]::Min($Width, $Height))
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath

    if ($diameter -le 0) {
        $path.AddRectangle([System.Drawing.RectangleF]::new($X, $Y, $Width, $Height))
        return $path
    }

    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-Canvas {
    param(
        [int]$Width,
        [int]$Height
    )

    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Png {
    param(
        [Parameter(Mandatory = $true)]$Bitmap,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }

    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-Ico {
    param(
        [Parameter(Mandatory = $true)]$Bitmap,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }

    $handle = $Bitmap.GetHicon()
    try {
        $icon = [System.Drawing.Icon]::FromHandle($handle)
        try {
            $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
            try {
                $icon.Save($stream)
            }
            finally {
                $stream.Dispose()
            }
        }
        finally {
            $icon.Dispose()
        }
    }
    finally {
        [NativeIcon]::DestroyIcon($handle) | Out-Null
    }
}

function Draw-LightfolioSquareIcon {
    param(
        [Parameter(Mandatory = $true)]$Graphics,
        [int]$Size,
        [switch]$Tiny
    )

    $Graphics.Clear([System.Drawing.Color]::Transparent)

    $backgroundPath = New-RoundedPath 0 0 $Size $Size ($Size * 0.22)
    $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.PointF]::new(0, 0),
        [System.Drawing.PointF]::new(0, $Size),
        (Get-Color '#0A1521'),
        (Get-Color '#173B55')
    )
    $Graphics.FillPath($backgroundBrush, $backgroundPath)

    $glowBrush = [System.Drawing.SolidBrush]::new((Get-Color '#B6E3FF' 28))
    $Graphics.FillEllipse($glowBrush, $Size * 0.11, $Size * 0.1, $Size * 0.42, $Size * 0.42)

    $shadowPath = New-RoundedPath ($Size * 0.275) ($Size * 0.245) ($Size * 0.37) ($Size * 0.5) ($Size * 0.085)
    $shadowMatrix = [System.Drawing.Drawing2D.Matrix]::new()
    $shadowMatrix.RotateAt(-8, [System.Drawing.PointF]::new($Size * 0.275, $Size * 0.245))
    $shadowPath.Transform($shadowMatrix)
    $shadowBrush = [System.Drawing.SolidBrush]::new((Get-Color '#29445D' 120))
    $shadowPen = [System.Drawing.Pen]::new((Get-Color '#D7EEFF' 26), [Math]::Max(1, $Size * 0.016))
    $Graphics.FillPath($shadowBrush, $shadowPath)
    $Graphics.DrawPath($shadowPen, $shadowPath)

    $cardX = $Size * 0.352
    $cardY = $Size * 0.209
    $cardWidth = $Size * 0.328
    $cardHeight = $Size * 0.57
    $cardPath = New-RoundedPath $cardX $cardY $cardWidth $cardHeight ($Size * 0.09)
    $cardBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.PointF]::new($cardX, $cardY),
        [System.Drawing.PointF]::new($cardX + $cardWidth, $cardY + $cardHeight),
        (Get-Color '#13293B'),
        (Get-Color '#0D1D2D')
    )
    $cardPen = [System.Drawing.Pen]::new((Get-Color '#E4F2FF' 46), [Math]::Max(1, $Size * 0.016))
    $Graphics.FillPath($cardBrush, $cardPath)
    $Graphics.DrawPath($cardPen, $cardPath)

    $innerInset = [Math]::Max(2, $Size * 0.03)
    $innerPath = New-RoundedPath ($cardX + $innerInset) ($cardY + $innerInset) ($cardWidth - $innerInset * 2) ($cardHeight - $innerInset * 2) ($Size * 0.066)
    $innerPen = [System.Drawing.Pen]::new((Get-Color '#E4F2FF' 20), [Math]::Max(1, $Size * 0.008))
    $Graphics.DrawPath($innerPen, $innerPath)

    $lightBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.PointF]::new($cardX, $cardY),
        [System.Drawing.PointF]::new($cardX, $cardY + $cardHeight),
        (Get-Color '#E2F5FF'),
        (Get-Color '#67B9F0')
    )

    $leftStrip = New-RoundedPath ($cardX + $cardWidth * 0.22) ($cardY + $cardHeight * 0.2) ($cardWidth * 0.26) ($cardHeight * 0.43) ($Size * 0.046)
    $bottomStrip = New-RoundedPath ($cardX + $cardWidth * 0.22) ($cardY + $cardHeight * 0.59) ($cardWidth * 0.56) ($cardHeight * 0.16) ($Size * 0.046)
    $Graphics.FillPath($lightBrush, $leftStrip)
    $Graphics.FillPath($lightBrush, $bottomStrip)

    $finderPen = [System.Drawing.Pen]::new((Get-Color '#CDEEFF' ($(if ($Tiny) { 96 } else { 132 }))), [Math]::Max(1, $Size * ($(if ($Tiny) { 0.022 } else { 0.018 }))))
    $finderPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $finderPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $finderInset = $cardWidth * 0.18
    $finderTop = $cardY + $cardHeight * 0.13
    $finderBottom = $cardY + $cardHeight * 0.82
    $finderLeft = $cardX + $finderInset
    $finderRight = $cardX + $cardWidth - $finderInset
    $finderLength = $cardWidth * 0.14

    $Graphics.DrawLine($finderPen, $finderLeft, $finderTop + $finderLength, $finderLeft, $finderTop)
    $Graphics.DrawLine($finderPen, $finderLeft, $finderTop, $finderLeft + $finderLength, $finderTop)
    $Graphics.DrawLine($finderPen, $finderRight - $finderLength, $finderTop, $finderRight, $finderTop)
    $Graphics.DrawLine($finderPen, $finderRight, $finderTop, $finderRight, $finderTop + $finderLength)
    $Graphics.DrawLine($finderPen, $finderLeft, $finderBottom - $finderLength, $finderLeft, $finderBottom)
    $Graphics.DrawLine($finderPen, $finderLeft, $finderBottom, $finderLeft + $finderLength, $finderBottom)
    $Graphics.DrawLine($finderPen, $finderRight - $finderLength, $finderBottom, $finderRight, $finderBottom)
    $Graphics.DrawLine($finderPen, $finderRight, $finderBottom - $finderLength, $finderRight, $finderBottom)

    if (-not $Tiny) {
        $dotOuterBrush = [System.Drawing.SolidBrush]::new((Get-Color '#DFF4FF' 230))
        $dotBrush = [System.Drawing.SolidBrush]::new((Get-Color '#79C3F6' 255))
        $dotSize = $Size * 0.05
        $dotX = $cardX + $cardWidth * 0.63
        $dotY = $cardY + $cardHeight * 0.25
        $Graphics.FillEllipse($dotOuterBrush, $dotX, $dotY, $dotSize, $dotSize)
        $Graphics.FillEllipse($dotBrush, $dotX + $dotSize * 0.27, $dotY + $dotSize * 0.27, $dotSize * 0.46, $dotSize * 0.46)
        $dotOuterBrush.Dispose()
        $dotBrush.Dispose()
    }

    $finderPen.Dispose()
    $lightBrush.Dispose()
    $innerPen.Dispose()
    $innerPath.Dispose()
    $cardPen.Dispose()
    $cardBrush.Dispose()
    $shadowPen.Dispose()
    $shadowBrush.Dispose()
    $glowBrush.Dispose()
    $backgroundBrush.Dispose()
    $bottomStrip.Dispose()
    $leftStrip.Dispose()
    $cardPath.Dispose()
    $shadowMatrix.Dispose()
    $shadowPath.Dispose()
    $backgroundPath.Dispose()
}

function New-SquareAsset {
    param(
        [int]$Size,
        [switch]$Tiny
    )

    $canvas = New-Canvas -Width $Size -Height $Size
    Draw-LightfolioSquareIcon -Graphics $canvas.Graphics -Size $Size -Tiny:$Tiny
    $canvas.Graphics.Dispose()
    return $canvas.Bitmap
}

function New-WideAsset {
    param(
        [int]$Width,
        [int]$Height,
        [switch]$Splash
    )

    $canvas = New-Canvas -Width $Width -Height $Height
    $graphics = $canvas.Graphics

    $backgroundPath = New-RoundedPath 0 0 $Width $Height ($Height * 0.18)
    $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.PointF]::new(0, 0),
        [System.Drawing.PointF]::new(0, $Height),
        (Get-Color '#0A1521'),
        (Get-Color '#173B55')
    )
    $graphics.FillPath($backgroundBrush, $backgroundPath)

    $glowBrush = [System.Drawing.SolidBrush]::new((Get-Color '#B6E3FF' 24))
    $graphics.FillEllipse($glowBrush, $Width * 0.03, $Height * 0.06, $Height * 0.58, $Height * 0.58)

    $iconSize = [int]($Height * ($(if ($Splash) { 0.42 } else { 0.54 })))
    $iconBitmap = New-SquareAsset -Size $iconSize
    $iconX = [int]($(if ($Splash) { ($Width - $iconSize) / 2 } else { $Height * 0.16 }))
    $iconY = [int](($Height - $iconSize) / 2)
    $graphics.DrawImage($iconBitmap, $iconX, $iconY, $iconSize, $iconSize)

    if (-not $Splash) {
        $titleBrush = [System.Drawing.SolidBrush]::new((Get-Color '#F3F7FC'))
        $subtitleBrush = [System.Drawing.SolidBrush]::new((Get-Color '#B6C4D5'))
        $titleFont = [System.Drawing.Font]::new('Segoe UI Semibold', [Math]::Max(18, $Height * 0.16), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $subtitleFont = [System.Drawing.Font]::new('Segoe UI', [Math]::Max(11, $Height * 0.08), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $textX = $iconX + $iconSize + ($Height * 0.12)
        $graphics.DrawString('Lightfolio', $titleFont, $titleBrush, [float]$textX, [float]($Height * 0.28))
        $graphics.DrawString('Photo workspace', $subtitleFont, $subtitleBrush, [float]$textX, [float]($Height * 0.56))
        $subtitleFont.Dispose()
        $titleFont.Dispose()
        $subtitleBrush.Dispose()
        $titleBrush.Dispose()
    }

    $iconBitmap.Dispose()
    $glowBrush.Dispose()
    $backgroundBrush.Dispose()
    $backgroundPath.Dispose()
    $graphics.Dispose()
    return $canvas.Bitmap
}

$resolvedAssetsDir = Resolve-Path -LiteralPath $AssetsDir -ErrorAction SilentlyContinue
if (-not $resolvedAssetsDir) {
    $fullAssetsDir = Join-Path (Get-Location) $AssetsDir
}
else {
    $fullAssetsDir = $resolvedAssetsDir.Path
}

if (-not (Test-Path $fullAssetsDir)) {
    New-Item -ItemType Directory -Path $fullAssetsDir | Out-Null
}

$resolvedElectronAssetsDir = Resolve-Path -LiteralPath $ElectronAssetsDir -ErrorAction SilentlyContinue
if (-not $resolvedElectronAssetsDir) {
    $fullElectronAssetsDir = Join-Path (Get-Location) $ElectronAssetsDir
}
else {
    $fullElectronAssetsDir = $resolvedElectronAssetsDir.Path
}

if (-not (Test-Path $fullElectronAssetsDir)) {
    New-Item -ItemType Directory -Path $fullElectronAssetsDir | Out-Null
}

$square150 = New-SquareAsset -Size 300
Save-Png -Bitmap $square150 -Path (Join-Path $fullAssetsDir 'Square150x150Logo.scale-200.png')
$square150.Dispose()

$square44 = New-SquareAsset -Size 88
Save-Png -Bitmap $square44 -Path (Join-Path $fullAssetsDir 'Square44x44Logo.scale-200.png')
$square44.Dispose()

$square24 = New-SquareAsset -Size 24 -Tiny
Save-Png -Bitmap $square24 -Path (Join-Path $fullAssetsDir 'Square44x44Logo.targetsize-24_altform-unplated.png')
$square24.Dispose()

$store = New-SquareAsset -Size 50
Save-Png -Bitmap $store -Path (Join-Path $fullAssetsDir 'StoreLogo.png')
$store.Dispose()

$lockScreen = New-SquareAsset -Size 48
Save-Png -Bitmap $lockScreen -Path (Join-Path $fullAssetsDir 'LockScreenLogo.scale-200.png')
$lockScreen.Dispose()

$wide = New-WideAsset -Width 620 -Height 300
Save-Png -Bitmap $wide -Path (Join-Path $fullAssetsDir 'Wide310x150Logo.scale-200.png')
$wide.Dispose()

$splash = New-WideAsset -Width 1240 -Height 600 -Splash
Save-Png -Bitmap $splash -Path (Join-Path $fullAssetsDir 'SplashScreen.scale-200.png')
$splash.Dispose()

$appIcon = New-SquareAsset -Size 256
Save-Ico -Bitmap $appIcon -Path (Join-Path $fullAssetsDir 'AppIcon.ico')
$appIcon.Dispose()

$electronIcon = New-SquareAsset -Size 256
Save-Ico -Bitmap $electronIcon -Path (Join-Path $fullElectronAssetsDir 'icon.ico')
Save-Png -Bitmap $electronIcon -Path (Join-Path $fullElectronAssetsDir 'icon.png')
$electronIcon.Dispose()

Write-Output "Generated Lightfolio branding assets in $fullAssetsDir and $fullElectronAssetsDir"