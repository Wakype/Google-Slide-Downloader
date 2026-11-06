$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

npm run build:store

$manifest = Get-Content "dist\manifest.json" -Raw | ConvertFrom-Json
$version = $manifest.version
$release = Join-Path $root "release"
New-Item -ItemType Directory -Force -Path $release | Out-Null

$zip = Join-Path $release "slides-capture-$version.zip"
if (Test-Path $zip) {
  Remove-Item $zip -Force
}

Compress-Archive -Path "dist\*" -DestinationPath $zip -CompressionLevel Optimal
Write-Output "Wrote $zip"
