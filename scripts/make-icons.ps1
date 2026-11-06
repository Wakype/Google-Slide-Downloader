Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot "..\public\icons"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$accent = [System.Drawing.Color]::FromArgb(79, 70, 229)
$white = [System.Drawing.Color]::White

foreach ($size in @(16, 32, 48, 128)) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $radius = [Math]::Max(2, [int]($size * 0.22))
  $d = $radius * 2
  $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
  $shape.AddArc(0, 0, $d, $d, 180, 90)
  $shape.AddArc($size - $d, 0, $d, $d, 270, 90)
  $shape.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $shape.AddArc(0, $size - $d, $d, $d, 90, 90)
  $shape.CloseFigure()

  $bg = New-Object System.Drawing.SolidBrush($accent)
  $g.FillPath($bg, $shape)

  $pad = [int]($size * 0.2)
  $w = $size - ($pad * 2)
  $h = [Math]::Max(2, [int]($w * 0.62))
  $x = $pad
  $y = [int](($size - $h) / 2)
  $slide = New-Object System.Drawing.SolidBrush($white)
  $g.FillRectangle($slide, $x, $y, $w, $h)

  $play = New-Object System.Drawing.Drawing2D.GraphicsPath
  $left = $x + [int]($w * 0.36)
  $right = $x + [int]($w * 0.68)
  $top = $y + [int]($h * 0.28)
  $bottom = $y + [int]($h * 0.72)
  $play.AddPolygon(@(
    (New-Object System.Drawing.Point($left, $top)),
    (New-Object System.Drawing.Point($right, [int](($top + $bottom) / 2))),
    (New-Object System.Drawing.Point($left, $bottom))
  ))
  $g.FillPath($bg, $play)

  $bmp.Save((Join-Path $out "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)

  $play.Dispose()
  $slide.Dispose()
  $shape.Dispose()
  $bg.Dispose()
  $g.Dispose()
  $bmp.Dispose()
}

Write-Output "icons written to $out"
