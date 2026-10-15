# M3 chat smoke test against a running build:
#   $env:LLM_ALLOW_UNEVALUATED = "true"; pnpm build; pnpm start -p 3123
# Signs up a throwaway account, exercises the chat with the real model (GROQ_API_KEY), the offline emergency card and
# the header Emergency button, then deletes the account and everything it created.
param([string]$Base = "http://localhost:3123", [string]$OutDir = "$env:TEMP\oya-e2e", [int]$Width = 1280, [int]$Height = 900)
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\cdp.ps1"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Set-Location (Resolve-Path "$PSScriptRoot\..\..")

$email = "e2e-chat-$([guid]::NewGuid().ToString().Substring(0,8))@integration.oya.test"
$password = "jollof on sunday 7"
$results = [ordered]@{}
function Check($name, $ok) { $results[$name] = $(if ($ok) { "PASS" } else { "FAIL" }) }
function Sql($q) { $ErrorActionPreference = "Continue"; (npx --no-install supabase db query --linked $q 2>$null | Out-String) }

# Waits for the latest Oya reply to finish (send button re-enabled) and returns ms to its first text.
function Ask([string]$text, [int]$timeoutMs = 30000) {
  Js "window.__first = null; window.__t0 = performance.now(); window.__obs?.disconnect(); window.__obs = new MutationObserver(() => { const b = [...document.querySelectorAll('[data-role=assistant] p')].pop(); if (b && !window.__first && b.innerText.trim() && !b.querySelector('span[aria-label]')) window.__first = performance.now() - window.__t0; }); window.__obs.observe(document.body, { subtree: true, childList: true, characterData: true }); 'ok'" | Out-Null
  Set-Field "#composer" $text | Out-Null
  Click-El "button[aria-label=Send]" | Out-Null
  $deadline = (Get-Date).AddMilliseconds($timeoutMs)
  Start-Sleep -Milliseconds 300
  while ((Get-Date) -lt $deadline) {
    if ((Js "document.querySelector('[data-chat-log]').getAttribute('aria-busy') === 'false'") -eq $true) { break }
    Start-Sleep -Milliseconds 250
  }
  Start-Sleep -Milliseconds 600
  return (Js "window.__first")
}
function LastReply() { Js "[...document.querySelectorAll('[data-role=assistant]')].pop()?.innerText ?? ''" }

Start-Browser -OutDir $OutDir -Width $Width -Height $Height
$userId = $null
try {
  Go "$Base/signup"
  Set-Field "#name" "Ada Chat" | Out-Null; Set-Field "#email" $email | Out-Null; Set-Field "#password" $password | Out-Null; Set-Field "#confirm" $password | Out-Null
  Click-El "input[name=adult]" | Out-Null; Click-El "input[name=terms]" | Out-Null; Click-El "form button[type=submit]" | Out-Null; Start-Sleep 5
  Check "sign-up lands in the chat" ((Get-Path) -eq "/app")
  $userId = ([regex]::Match((Sql "select id from internal.users where email = '$email'"), '"id": "([0-9a-f-]{36})"')).Groups[1].Value
  Check "empty state shows suggestions" ((Js "document.body.innerText.includes('Has light come back?')") -eq $true)
  Shot "m3-empty"

  # Browser keyword check: the card appears while typing, before anything is sent.
  Set-Field "#composer" "Accident for Oron Road, person dey bleed" | Out-Null; Start-Sleep -Milliseconds 400
  Check "typing an emergency shows the card locally" ((Js "!!document.querySelector('a[href=""tel:112""]')") -eq $true)
  Set-Field "#composer" "" | Out-Null

  $t = Ask "How much is passport renewal now?"
  $reply = LastReply
  Check "a paperwork question gets an honest reply (no guides yet)" ($reply.Length -gt 10 -and $reply -notmatch [string][char]0x20A6)
  $results["first sentence ms (paperwork)"] = "$t"
  Shot "m3-paperwork"

  $t2 = Ask "Light don come for Ewet?"
  $results["first sentence ms (power, not built)"] = "$t2"
  Check "an unbuilt skill answers honestly" ((LastReply) -match "learning|team")

  [void](Ask "who won the world cup in 2010")
  Check "off-scope gets the fixed redirect" ((LastReply) -match "outside what I do|no be my work")

  [void](Ask "my NIN is 12345678901")
  Check "ID numbers are hidden and the user is warned" ((Js "document.body.innerText.includes('Please don')") -eq $true)
  $stored = Sql "select text from public.messages m join public.conversations c on c.id = m.conversation_id where c.user_id = '$userId' and m.role = 'user' and m.text like 'my NIN%'"
  Check "the stored message is redacted" ($stored -match '\[ID number\]' -and $stored -notmatch '12345678901')

  # Network off: the emergency card still shows, sends are refused, the draft is kept.
  [void](Send "Network.enable" @{})
  [void](Send "Network.emulateNetworkConditions" @{ offline = $true; latency = 0; downloadThroughput = -1; uploadThroughput = -1 })
  Start-Sleep 1
  Set-Field "#composer" "fire don catch for our compound" | Out-Null; Start-Sleep -Milliseconds 400
  Check "offline: the emergency card shows" ((Js "!!document.querySelector('a[href=""tel:112""]')") -eq $true)
  Click-El "button[aria-label=Send]" | Out-Null; Start-Sleep 1
  Check "offline: the message isn't sent and the draft is kept" ((Js "document.querySelector('#composer').value") -eq "fire don catch for our compound")
  Shot "m3-offline"
  Set-Field "#composer" "" | Out-Null
  Click-El "[data-emergency-button]" | Out-Null; Start-Sleep -Milliseconds 500
  Check "offline: the header Emergency button opens the card" ((Js "!!document.querySelector('dialog[open] a[href=""tel:112""]')") -eq $true)
  Shot "m3-emergency-dialog"
  [void](Send "Network.emulateNetworkConditions" @{ offline = $false; latency = 0; downloadThroughput = -1; uploadThroughput = -1 })

  # Reload keeps the conversation.
  Go "$Base/app" 3000
  Check "history survives a reload" ((Js "document.querySelectorAll('[data-role=user]').length") -ge 3)
}
finally {
  Stop-Browser
  if ($userId) {
    Sql "select public.purge_user_data(array['$userId']::uuid[])" | Out-Null
    Sql "select public.auth_delete_user('$userId', null)" | Out-Null
  }
}

$results.GetEnumerator() | ForEach-Object { "{0}  {1}" -f $_.Value, $_.Key }
$left = Sql "select count(*) as n from internal.users where email like '%@integration.oya.test'"
"test accounts left: " + ([regex]::Match($left, '"n": (\d+)').Groups[1].Value)
