# Applies pending migrations to the linked Supabase project without printing the database password.
# Usage: .\scripts\db-push.ps1   (reads DATABASE_URL from .env; see docs/decisions.md D-005)
Set-Location (Resolve-Path "$PSScriptRoot\..")
$raw = ((Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', '').Trim('"')
if ($raw -notmatch '^(postgres(?:ql)?://)([^:]+):(.*)@([^@]+)$') { Write-Error "Could not parse DATABASE_URL in .env"; exit 1 }
$pw = $matches[3]
$env:SUPABASE_DB_PASSWORD = $pw
$ErrorActionPreference = "Continue"
$out = (npx --no-install supabase db push --linked --yes 2>&1 | Out-String)
Remove-Item Env:SUPABASE_DB_PASSWORD
$out.Replace($pw, '***') -split "`n" | Where-Object { $_ -match 'Applying|Finished|ERROR|error|failed|Up to date|at statement' -and $_ -notmatch 'NativeCommandError' }
