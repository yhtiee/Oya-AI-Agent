# Minimal Chrome DevTools Protocol driver for headless Edge, for local smoke tests on Windows.
# Dot-source it, call Start-Browser, then use Go / Js / Shot / Stop-Browser.
$script:edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$script:id = 0

function Start-Browser([string]$OutDir, [int]$Width = 1280, [int]$Height = 900) {
  $script:out = $OutDir
  $profileDir = Join-Path $OutDir "edge-profile"
  if (Test-Path $profileDir) { Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue }
  $script:proc = Start-Process $script:edgePath -ArgumentList "--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=9333", "--user-data-dir=$profileDir", "--window-size=$Width,$Height", "about:blank" -PassThru
  Start-Sleep 3
  $page = (Invoke-RestMethod http://localhost:9333/json) | Where-Object { $_.type -eq "page" } | Select-Object -First 1
  $script:ws = New-Object System.Net.WebSockets.ClientWebSocket
  $script:ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  [void](Send "Emulation.setDeviceMetricsOverride" @{ width = $Width; height = $Height; deviceScaleFactor = 1; mobile = ($Width -lt 600) })
  [void](Send "Page.enable" @{})
}

function Send($method, $params) {
  $script:id++
  $msg = @{ id = $script:id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
  $script:ws.SendAsync([ArraySegment[byte]]$bytes, "Text", $true, [Threading.CancellationToken]::None).Wait()
  while ($true) {
    $sb = New-Object Text.StringBuilder
    do {
      $buf = New-Object byte[] 1048576
      $r = $script:ws.ReceiveAsync([ArraySegment[byte]]$buf, [Threading.CancellationToken]::None).Result
      [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $r.Count))
    } while (-not $r.EndOfMessage)
    $resp = $sb.ToString() | ConvertFrom-Json
    if ($resp.id -eq $script:id) { return $resp }
  }
}

function Go([string]$url, [int]$waitMs = 2500) { [void](Send "Page.navigate" @{ url = $url }); Start-Sleep -Milliseconds $waitMs }
function Js([string]$expr) { (Send "Runtime.evaluate" @{ expression = $expr; returnByValue = $true; awaitPromise = $true }).result.result.value }
function Shot([string]$name) {
  $res = Send "Page.captureScreenshot" @{ format = "png" }
  [IO.File]::WriteAllBytes((Join-Path $script:out "$name.png"), [Convert]::FromBase64String($res.result.data))
}
# Sets a React-controlled input's value so React sees the change.
function Set-Field([string]$selector, [string]$value) {
  $v = $value.Replace("\", "\\").Replace("'", "\'")
  Js "(() => { const el = document.querySelector('$selector'); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, '$v'); el.dispatchEvent(new Event('input', { bubbles: true })); return 'ok'; })()"
}
function Click-El([string]$selector) { Js "(() => { const el = document.querySelector('$selector'); if (!el) return 'missing'; el.click(); return 'ok'; })()" }
function Get-Path() { Js "location.pathname + location.search" }

function Stop-Browser {
  if ($script:ws) { $script:ws.Dispose() }
  if ($script:proc) { Stop-Process -Id $script:proc.Id -Force -ErrorAction SilentlyContinue }
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*edge-profile*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
