# Decisions

Choices made where SPEC.md is silent, or where the founder chose differently from the spec (SPEC §0 rule 5).
Newest first. Each entry: what, why, and how to revisit.

## D-027 — Golden-conversation evals wait for model capacity (founder decision, M4, 2026-10-18)

M4's quality bar includes golden conversations ≥ 85% for power, reminders and local alerts. Grading them needs a few
hundred model calls per run, more than Groq's free tier allows in a day (D-019). The founder chose to leave the capacity
question for later, so the golden fixtures and grader aren't built yet. Everything else in M4 is tested with scripted
models (`tests/integration/m4-chat.test.ts`) and against the live database. **Revisit:** when capacity is decided.

## D-026 — An in-app inbox alongside web push (founder decision, M4, 2026-10-18)

Every notification is also an inbox entry (the bell in the app header), because web push alone is unreliable on the
Android brands most Uyo users have (§4.3, SPEC risk N3). The `push` notification row doubles as the inbox entry; the
bell polls once a minute while the app is open. Users read their own notifications through RLS; marking read goes
through a server action.

## D-025 — SMS and WhatsApp notifications in mock mode (founder decision, M4, 2026-10-18)

The Termii SMS and WhatsApp template adapters are built and wired into the delivery order (§5.7), but run in mock mode
(`INTEGRATIONS_MODE=mock`): rows are created and marked sent with a `mock-…` external id, nothing leaves the server.
SMS needs the CAC certificate for a sender ID; WhatsApp needs Meta verification and approved templates (and its flag is
GATED). The 3-SMS-per-user-per-day cap is enforced already. **Revisit:** set `INTEGRATIONS_MODE=live`, `TERMII_*` once
the sender ID exists; turn on `whatsapp_user_notifications` once templates are approved.

## D-024 — Features honour their flags; non-production can force flags on (M4, 2026-10-18)

From M4 the pipeline runs a skill only if its flag is on (R12), and the power, watch and reminder taps check theirs.
In the shared project `skill_power`, `skill_paperwork`, `local_alerts`, `reminders` and `watches` are **off**, so
production behaves as before until the founder turns them on in the ops console or SQL. `FLAGS_FORCE_ON`
(comma-separated, ignored in production) lets local development and tests use features without changing the shared
database. Also in M4: a confirmed power change queues its `watch_eval` job from a database trigger, so every path that
confirms a change (a report, ops, the 10-minute recompute) fires watches; reminders set for a time inside quiet hours
still fire (the user chose that time), while watches and the digest stay quiet unless overnight alerts are on.

## D-023 — Eval fixtures are a team draft; a model grader isn't used yet (M3, 2026-10-15)

The first 100 router utterances (48% Pidgin) and the 110-case safety suite in `evals/fixtures/` were written by the team,
not by Uyo speakers as §7.12 asks. They are good enough to choose a model and catch regressions, not to sign off a
launch. Router and safety suites are scored exactly (labels), so no grader model is needed yet; the golden-conversation
suite (M4) will need one. **Revisit:** Pilot 0 ambassadors write and record ≥ 200 utterances (≥ 40% Pidgin) and review
the emergency phrases (`config/emergency-phrases.json`) with native Pidgin and Ibibio speakers.

## D-022 — M3 ships one stub skill (M3, 2026-10-15)

`paperwork` runs as the stub skill: it answers only from published guides (none exist yet, so it says Oya hasn't
checked that process and offers a teammate) and can propose `record_preference`, which exercises confirmations end to
end. Every other skill is routed and logged as demand, then answered honestly ("still learning to do that here")
until its milestone. Web turns don't create tasks yet; skills that need one create it from M4.

## D-021 — A small hand-written service worker instead of Serwist (M3, 2026-10-15)

`public/sw.js` precaches `/help/emergency` and caches built static assets; a failed page load falls back to the
emergency page. Personal pages and API responses are never cached. The browser keyword check works offline once the
chat is open. Serwist's App Router integration needs a webpack build step that Next 16's Turbopack build doesn't run.
**Revisit:** with the offline outbox (Phase 1b).

## D-020 — Web pipeline details the spec leaves open (M3, 2026-10-15)

- **Busy conversation:** if the lease isn't free within 15 seconds, the web reply says "still working on your last
  message" rather than enqueuing a `process_inbound` job (the web has no inbound job handler until channels arrive).
- **Button mode:** typed messages aren't queued as `deferred_message` jobs yet (that handler lands with notifications,
  M4); the reply asks the user to try again later instead of promising to read it.
- **Card taps** claim the confirmation atomically but don't take the conversation lease; claim_confirmation already
  makes a double run impossible.
- **Tool-call logs** without a task go to `internal.analytics_events` (`agent.tool_call`, redacted); with a task they
  are `task_events` (`tool_call`, ops visibility) as §7.5 says.
- **Rate limits (429)** from the model provider don't count as breaker failures: they're quota, not an outage. The call
  waits for `retry-after` if the turn has time; otherwise the user gets "Lots of people are asking right now… 112".

## D-019 — Groq free tier as the bootstrap model provider (founder decision, M3, 2026-10-15)

**Differs from the spec**, which makes Gemini (paid tier) primary in bootstrap mode (§20.1, ADR-22). The founder asked
for a free provider. Groq was chosen over the alternatives offered:

- Google AI Studio's **free** tier uses prompts for training; Oya handles health, emergency and self-harm messages, and
  §10.1a already restricts Gemini to the paid tier for that reason.
- NVIDIA NIM and GitHub Models are for development and testing only; OpenRouter's free tier allows 50 requests a day.
- Groq has a permanent free tier, is fast (helps the 5-second first-sentence target), supports strict JSON-schema output
  and tool calls, and states it doesn't train on API data (**founder to confirm in Groq's terms**).

Defaults (`config/llm-routing.json`): router and safety classifier on `openai/gpt-oss-20b`, skills on
`openai/gpt-oss-120b`, Gemini wired as an optional, disabled fallback. The eval suites decide the final pick.

**Capacity (measured 2026-10-15):** per model, 8,000 tokens a minute, 1,000 requests a day and, the binding limit, **200,000
tokens a day** (only visible in the 429 error, not in the rate-limit headers). A router call is about 2,700–3,000
tokens, so each model handles about **65–70 router-sized calls a day** and about 3 a minute. With the router and skills
on different models that is roughly 60 user messages a day: enough for development, **not** for Pilot 0. Eval runs
(210 calls per model) exceed a day's allowance on their own.
Free-tier calls are logged at $0 (`billed: false` in `config/llm-prices.json`) with their list price kept for the cost
report. `LLM_ALLOW_UNEVALUATED=true` lets non-production environments run purposes before their eval report exists.
**Revisit:** a paid tier (Groq Developer, or Gemini/Claude per the §20.1 ladder) before any public launch; shrinking the
router prompt's examples raises capacity but needs a fresh eval run.

## D-018 — No seed data in the shared project (M2, 2026-10-15)

SPEC M2 asks for areas, a dev-only fake provider set and draft KB documents as seed data. With one live project (D-005)
that also holds the real waitlist, fake providers would be visible to real users. So nothing is seeded:
`scripts/import-areas.ts` imports real boundaries once ambassadors map them, KB documents are written and verified in M5,
and tests create and delete their own data. `supabase db reset` can't be run against the live project. **Revisit:**
add `supabase/seed.sql` with fake providers once a local or staging database exists.

## D-017 — pg_cron is the only tick trigger for now (M2, 2026-10-15)

SPEC §9 also uses Vercel Cron every minute, but that needs the Pro plan; on Hobby a per-minute cron fails the deploy.
The tick endpoint already accepts Vercel's `Authorization: Bearer CRON_SECRET`, so turning it on later means only adding
`vercel.json` with `{"crons":[{"path":"/api/internal/tick","schedule":"* * * * *"}]}`. pg_cron reads its URL and
secret from Vault (`oya_tick_url`, `oya_cron_secret`, optional `oya_vercel_bypass`) and does nothing until they're set.

## D-016 — Payments, refunds, guarantee claims and price reports wait for their phase (M2, 2026-10-15)

They are Phase 1b/2 tables (§12.2) and nothing in 1a writes them. They arrive with the milestone that first uses them, so
their RLS is designed alongside the flows.

## D-015 — Version conflicts raise `PT409`, not `40001` (M2, 2026-10-15)

**Differs from the spec** (§8.2 says `serialization_failure`). PostgREST retries a transaction itself when it sees
`40001`, so a stale-version call hung instead of returning. `transition_task` raises `PT409` (PostgREST turns it into
HTTP 409), and `transitionTask()` re-reads and retries up to 3 times as the spec describes.

## D-014 — Server-only functions live in `public`, granted to `service_role` (M2, 2026-10-15)

SPEC §12.4 names some functions `internal.*` (`claim_jobs`, `ingest_webhook`, `claim_job_by_id`,
`llm_breaker_record`, `record_web_lookup`). The `internal` schema isn't exposed through the Data API (D-010), so they are
`public.*` security-definer functions with `execute` revoked from everyone except `service_role`; the tables stay in
`internal`. Also added beyond the spec: `enqueue_job`, `complete_job`, `fail_job`, `reap_jobs`, `record_heartbeat`,
`jobs_overview`, `log_llm_call`, `llm_breaker_check`, `track_event`, `create_confirmation` (atomically supersedes the
previous pending one), `record_power_report` (ops, DisCo and button replies), `claim_watch_fire`, `delete_jobs` and
`task_timer_jobs` (retention and tests), and `task_timer_valid` (the §8.3 check, by event sequence number).

## D-013 — Server error messages are English only for now (M1, 2026-10-08)

Form labels and page copy come from the `en` / `pcm` catalogues, but messages returned by server actions ("Too many wrong
passwords…") are English strings. **Revisit:** return message keys from actions and translate them in the form (with M3,
when the chat UI adds many more messages).

## D-012 — Database tests run as integration tests, not pgTAP (M1, 2026-10-08)

SPEC §16.7 specifies pgTAP via `supabase test db`. With one live project (D-005), tests run instead as Vitest integration
tests (`pnpm test:integration`) against the linked project, using real tokens signed by our server, and delete their own
test users. They prove the M1 acceptance ("one user can't read another's profile") end to end, through PostgREST, which
pgTAP wouldn't. `tests/e2e-local/identity-smoke.ps1` drives a real browser through every identity flow. **Revisit:** add
pgTAP files once a staging project or local Supabase exists.

## D-011 — Sessions: 30 days, extended while in use (M1, 2026-10-08)

A session expires after 30 days without activity, which is stricter than the spec's 180-day re-verification rule (§3.3)
and makes that rule unnecessary for password sign-in. Changing your password signs out every other device. Ops/admin
sessions start at `aal1` and become `aal2` only after a TOTP code; removing a role revokes that person's `aal2`
sessions at once.

## D-010 — Oya-managed auth, with Supabase-compatible tokens (founder decision, M1, 2026-10-08)

**Differs from the spec**, which builds on Supabase Auth (§4.6). The founder chose to run email + password sign-in
ourselves. To keep the spec's security model, the server signs short-lived (15 min) ES256 access tokens for each
session with a key imported into the Supabase project as a JWT signing key (`SUPABASE_JWT_SIGNING_KEY`, generated by
`scripts/generate-jwt-signing-key.ts`). Supabase verifies them like its own, so:

- RLS policies use `auth.uid()` and `auth.jwt() ->> 'app_role' / 'aal'` exactly as §12.3 describes;
- Realtime (M3) can authorise subscriptions the same way;
- the custom access token hook (§4.6) isn't needed: the server adds `app_role` and `aal` itself.

Credentials (scrypt, N=2^17), sessions (SHA-256 of a 32-byte cookie token), TOTP secrets (AES-256-GCM with
`APP_ENCRYPTION_KEY`), rate limits and the audit log live in the `internal` schema, which isn't exposed through the
Data API; the server reaches it only through `auth_*` security-definer functions executable by `service_role`.
`@supabase/ssr` was removed. **Key rotation:** generate a new key, import it as standby, switch the env var, then revoke
the old key in Supabase.

## D-009 — `/help/emergency` shows only 112 until ops verify local numbers (M0, 2026-10-08)

SPEC §15.4 lists Akwa Ibom ambulance lines and self-harm support lines, all "ops-verified". None are verified yet, so
`config/emergency-resources.json` holds them with `verified: false` and the page shows only 112 plus a line saying local
numbers are being checked. **Revisit:** Pilot 0 ambassadors call each number, then set `verified: true` and `verifiedAt`.

## D-008 — Pidgin copy is a draft (M0, 2026-10-08)

`src/i18n/pcm.json` was written to get the catalogue structure in place. SPEC §14.9 requires Pidgin copy written and
reviewed by native speakers from the launch area; the file's `meta.status` says so. **Revisit:** native-speaker review
before launch.

## D-007 — `bootstrap_mode` flag seeded **on** (M0, 2026-10-08)

The founder is self-funding, which is the case SPEC §20.1 describes. Every other flag is seeded off. The
`BOOTSTRAP_MODE` env var overrides the flag at boot if set.

## D-006 — Sign-in: email + password first (founder decision, M1, 2026-10-08)

**Differs from the spec.** SPEC §4.6 uses phone OTP, and bootstrap mode (§20.1) uses Google sign-in plus a 6-digit
email code. The founder chose email + password for now. M1 will build it through server actions with the same rate
limits and the 18+ age confirmation, and keep phone OTP behind the `phone_otp` flag. Recorded in
`docs/spec-questions.md` (SQ-001). **Revisit:** before launch, decide whether to add Google/email code (§20.1) or phone
OTP (§4.6).

## D-005 — One Supabase project for now (founder decision, M0, 2026-10-08)

**Differs from the spec.** SPEC §16.4 and §21.1 call for separate dev, staging and prod projects and local Supabase
(Docker). Docker isn't installed and the founder chose to build on the existing linked project, which also holds the
live waitlist. Consequences:

- Migrations are applied with `pnpm db:push` to the live project. Every migration must be additive and reviewed first.
- `supabase db reset` and local pgTAP runs (`supabase test db`) aren't available. M1/M2 database tests will run against
  the linked project inside transactions that roll back, or wait for a staging project.
- **Revisit:** create a free staging project (Supabase Free allows 2) or install Docker before M2, whose acceptance
  criteria include `supabase db reset`.

## D-004 — Supabase CLI via `npx`, not a dev dependency (M0, 2026-10-08)

Windows Smart App Control blocks the CLI binary that pnpm downloads into `node_modules`, but allows the copy already in
the npx cache. The `db:*` scripts call `npx supabase`. CI runs on Linux and is unaffected.

## D-003 — Publishable key naming (M0, 2026-10-08)

SPEC §21.3 names `NEXT_PUBLIC_SUPABASE_ANON_KEY`; Supabase now issues "publishable" keys. `src/server/env.ts` accepts
either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` may hold
the new-style secret key.

## D-002 — Repository layout (M0, 2026-10-08)

Follows SPEC §21.2 with the repo root at `oya-ai/` (the spec's `oya/`). The landing page moved to
`src/app/(marketing)/`, its components to `src/components/marketing/`, and its data to `src/lib/marketing/`. The
waitlist action lives in `src/server/actions/waitlist.ts`. It is the one public (unauthenticated) action, so it doesn't
go through `authedAction()`; it calls the security-definer `join_waitlist()` RPC, which validates everything itself.

## D-001 — Pinned versions (M0, 2026-10-08)

SPEC §21.1 asks for exact pins recorded here. Node 22 LTS in CI (local machine runs Node 24; `engines` allows ≥22).
pnpm 11.25.0, with dependency build scripts limited by `allowBuilds` in `pnpm-workspace.yaml`.

| Package               | Version | Package                  | Version       |
| --------------------- | ------- | ------------------------ | ------------- |
| next                  | 16.3.8  | react / react-dom        | 19.2.8        |
| @supabase/supabase-js | 2.117.2 | @supabase/ssr            | 0.12.7        |
| zod                   | 4.6.5   | next-intl                | 4.14.9        |
| @sentry/nextjs        | 11.5.0  | tailwindcss              | 4.3.3         |
| @radix-ui/react-slot  | 1.4.0   | class-variance-authority | 0.7.1         |
| lucide-react          | 1.52.0  | libphonenumber-js        | 1.13.14       |
| date-fns              | 4.4.0   | date-fns-tz              | 3.2.0         |
| typescript            | 5.9.3   | eslint                   | 9.39.5        |
| vitest                | 5.0.3   | prettier                 | 3.9.9         |
| tsx                   | 4.23.15 | Supabase CLI             | 2.120.0 (npx) |

Not installed yet, added in the milestone that first needs them: `ai`, `@ai-sdk/google`, `@ai-sdk/anthropic` (M3),
`chrono-node`, `rrule`, `web-push` (M4), `@serwist/next` (M3/M4), `@playwright/test` (M3).

`libphonenumber-js` uses its default (min) metadata, which can't tell mobiles from landlines, so
`isNigerianMobile()` checks the national prefix (070/080/081/090/091) directly instead of loading the full metadata.
