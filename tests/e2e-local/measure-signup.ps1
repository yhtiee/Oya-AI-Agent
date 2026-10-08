# Measures whether /signup fits without scrolling at common screen sizes, and screenshots each.
param([string]$Base = "http://localhost:3123", [string]$OutDir = "$env:TEMP\oya-e2e")
. "$PSScriptRoot\cdp.ps1"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$sizes = @(@(1366, 768), @(1280, 720), @(390, 844), @(360, 740))
Start-Browser -OutDir $OutDir -Width 1366 -Height 768
try {
  foreach ($s in $sizes) {
    [void](Send "Emulation.setDeviceMetricsOverride" @{ width = $s[0]; height = $s[1]; deviceScaleFactor = 1; mobile = ($s[0] -lt 600) })
    Go "$Base/signup" 2500
    $h = Js "document.documentElement.scrollHeight"
    $btn = Js "Math.round(document.querySelector('form button[type=submit]').getBoundingClientRect().bottom)"
    "{0}x{1}: page height {2}, submit button bottom {3} -> {4}" -f $s[0], $s[1], $h, $btn, $(if ($h -le $s[1]) { "fits" } else { "scrolls by $($h - $s[1])px" })
    Shot ("signup-{0}x{1}" -f $s[0], $s[1])
  }
} finally { Stop-Browser }
