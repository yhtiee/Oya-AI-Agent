# M1 smoke test against a running build (pnpm build && pnpm start -p 3123).
# Creates a throwaway account, walks every identity flow, then deletes the account.
param([string]$Base = "http://localhost:3123", [string]$OutDir = "$env:TEMP\oya-e2e")
$ErrorActionPreference = "Continue"
. "$PSScriptRoot\cdp.ps1"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Set-Location (Resolve-Path "$PSScriptRoot\..\..")

$email = "e2e-$([guid]::NewGuid().ToString().Substring(0,8))@integration.oya.test"
$password = "jollof on sunday 7"
$results = [ordered]@{}
function Check($name, $ok) { $results[$name] = $(if ($ok) { "PASS" } else { "FAIL" }) }
# Waits until the path matches (sign-up and sign-in hash passwords slowly on purpose).
function WaitPath([string]$like, [int]$timeoutMs = 15000) { $end = (Get-Date).AddMilliseconds($timeoutMs); while ((Get-Date) -lt $end) { if ((Get-Path) -like $like) { return $true }; Start-Sleep -Milliseconds 300 }; return $false }
function WaitText([string]$regex, [int]$timeoutMs = 15000) { $end = (Get-Date).AddMilliseconds($timeoutMs); while ((Get-Date) -lt $end) { if ((Js "/$regex/i.test(document.body.innerText)") -eq $true) { return $true }; Start-Sleep -Milliseconds 300 }; return $false }
function Sql($q) { $ErrorActionPreference = "Continue"; (npx --no-install supabase db query --linked $q 2>$null | Out-String) }
function Totp($secret) { $ErrorActionPreference = "Continue"; $env:OYA_TOTP_SECRET = $secret; (pnpm exec tsx -e "import { totpAt, base32Decode, timeStep } from './src/server/auth/totp.ts'; console.log(totpAt(base32Decode(process.env.OYA_TOTP_SECRET), timeStep()))" 2>$null | Select-Object -Last 1).Trim() }

# Each run makes 4 sign-up attempts and the limit is 5 an hour per connection (working as designed), so clear the
# current hour's sign-up and sign-in counters first. Pre-launch only: this also resets them for anyone else.
Sql "delete from internal.rate_limits where (key like 'signup:ip:%' or key like 'signin:ip:%') and window_start > now() - interval '1 hour'" | Out-Null

Start-Browser -OutDir $OutDir -Width 1280 -Height 1000
try {
  # Signed-out visitors are sent to sign in
  Go "$Base/app/settings"
  Check "proxy redirects signed-out /app to /login" ((Get-Path) -like "/login?next=%2Fapp%2Fsettings*")

  # Under-18: no account, nothing stored
  Go "$Base/signup"
  Set-Field "#name" "Kid"; Set-Field "#email" $email; Set-Field "#password" $password
  Js "[...document.querySelectorAll('main button')].find(b => b.textContent.includes('18'))?.click(); 'ok'"; Start-Sleep 1
  Check "under-18 sees the explanation and 112" ((Js "document.body.innerText.includes('112') && !!document.querySelector('a[href=""tel:112""]')") -eq $true)
  Check "under-18 stored nothing" ((Sql "select count(*) as n from internal.users where email = '$email'") -match '"n": 0')
  Shot "m1-under18"

  # Sign up
  Go "$Base/signup?next=%2Fapp%2Fsettings"
  Click-El "form button[type=submit]"; Start-Sleep 1
  Check "empty sign-up shows field errors" ((Js "document.querySelectorAll('[aria-invalid=true]').length") -ge 3)
  Set-Field "#name" "Ada Test"; Set-Field "#email" $email; Set-Field "#password" "short"; Set-Field "#confirm" "short"
  Click-El "input[name=adult]"; Click-El "input[name=terms]"; Click-El "form button[type=submit]"; Start-Sleep 2
  Check "weak password is refused" ((Js "document.body.innerText.includes('Use at least 10')") -eq $true)
  Check "name and email survive a failed submit" ((Js "document.querySelector('#email').value") -eq $email)
  Set-Field "#password" $password; Set-Field "#confirm" "different password 9"; Click-El "form button[type=submit]"
  Check "mismatched passwords are refused" (WaitText "n.t match")
  Js "document.querySelector('#password').parentElement.querySelector('button').click(); 'ok'" | Out-Null; Start-Sleep -Milliseconds 500
  Check "eye button reveals the password" ((Js "document.querySelector('#password').type") -eq "text")
  Set-Field "#password" $password; Set-Field "#confirm" $password; Click-El "form button[type=submit]"
  Check "sign-up lands on ?next" (WaitPath "/app/settings")
  Shot "m1-settings"

  # Duplicate email
  Js "document.cookie" | Out-Null
  # Settings: change language to Pidgin
  Js "document.querySelector('#language').value = 'pcm'; 'ok'" | Out-Null
  Click-El "section[aria-labelledby=profile-title] form button[type=submit]"; Start-Sleep 3
  Go "$Base/app"
  Check "language switch shows Pidgin" ((Js "document.body.innerText.includes('Wetin you need, Ada')") -eq $true)
  Shot "m1-app-pcm"

  # Sign out, then sign in
  Click-El "header form button[type=submit]"
  Check "sign-out returns to the landing page" (WaitPath "/")
  Go "$Base/app"
  Check "after sign-out /app needs sign-in again" ((Get-Path) -like "/login*")
  Set-Field "#email" $email; Set-Field "#password" "wrong password here"; Click-El "form button[type=submit]"
  Check "wrong password gives a generic error" (WaitText "n.t match")
  Start-Sleep 1
  Set-Field "#password" $password; Click-El "form button[type=submit]"
  Check "sign-in works" (WaitPath "/app")

  # Staff: ops role needs two-factor
  $userId = ([regex]::Match((Sql "select id from internal.users where email = '$email'"), '"id": "([0-9a-f-]{36})"')).Groups[1].Value
  Sql "select public.auth_set_role('$userId', 'ops', null)" | Out-Null
  Go "$Base/ops"
  Check "ops without 2FA is sent to /ops/verify" ((Get-Path) -like "/ops/verify*")
  Click-El "main button"; Start-Sleep 3
  Shot "m1-mfa-enrol"
  $secret = ([string](Js "document.querySelector('p.font-mono')?.innerText ?? ''")).Replace(" ", "")
  Check "enrolment shows a QR code and key" (($secret.Length -eq 32) -and ((Js "!!document.querySelector('img[alt*=QR]')") -eq $true))
  Set-Field "#code" "000000"; Click-El "form button[type=submit]"; Start-Sleep 2
  Check "a wrong code is refused" ((Get-Path) -like "/ops/verify*")
  Set-Field "#code" (Totp $secret); Click-El "form button[type=submit]"
  Check "a correct code opens the ops console" (WaitPath "/ops")
  Shot "m1-ops"

  # Lockout after 5 wrong passwords
  Click-El "header a[href='/app']" | Out-Null
  Go "$Base/app"; Click-El "header form button[type=submit]"; Start-Sleep 3
  for ($i = 0; $i -lt 5; $i++) { Go "$Base/login" 1500; Set-Field "#email" $email; Set-Field "#password" "nope nope nope $i"; Click-El "form button[type=submit]"; Start-Sleep 2 }
  Go "$Base/login" 1500; Set-Field "#email" $email; Set-Field "#password" $password; Click-El "form button[type=submit]"; Start-Sleep 2
  Check "account locks after 5 wrong passwords, even for the right one" ((Js "document.body.innerText.includes('Try again in')") -eq $true)
  Shot "m1-locked"

  # Audit trail
  $audit = Sql "select action, count(*) as n from internal.audit_log where actor_id = '$userId' group by action order by action"
  Check "audit log recorded sign-up, sign-in, failures and MFA" (($audit -match 'sign_up') -and ($audit -match 'sign_in_failed') -and ($audit -match 'mfa_enrolled'))
}
finally {
  Stop-Browser
  if ($userId) { Sql "select public.auth_delete_user('$userId', null)" | Out-Null }
}

$results.GetEnumerator() | ForEach-Object { "{0}  {1}" -f $_.Value, $_.Key }
$left = Sql "select count(*) as n from internal.users where email like '%@integration.oya.test'"
"test accounts left: " + ([regex]::Match($left, '"n": (\d+)').Groups[1].Value)
