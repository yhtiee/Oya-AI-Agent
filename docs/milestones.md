# Milestones

Progress against SPEC §21.4. Each milestone ends with tests green, migrations applied and a short demo note.

## M0 — Foundations and external prerequisites

**Status:** built, awaiting founder review (2026-10-08).

### Code

| Item                                                                | Where                                                                 | Status                                                   |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Next.js app under `src/` per §21.2                                  | `src/app`, `src/server`, `src/lib`, `src/components`                  | done                                                     |
| pnpm, exact pins                                                    | `package.json`, `pnpm-workspace.yaml`, `docs/decisions.md` D-001      | done                                                     |
| Tailwind v4 brand tokens as `--oya-*` variables                     | `src/app/globals.css`, `config/oya-brand.json`                        | done, drift-tested                                       |
| Fonts: Bricolage 700/800, DM Sans 400/700; Caveat on marketing only | `src/app/layout.tsx`, `src/app/(marketing)/layout.tsx`                | done                                                     |
| shadcn/ui base, restyled to Oya tokens                              | `components.json`, `src/components/ui/button.tsx`, `src/lib/utils.ts` | done                                                     |
| i18n scaffolding (`en`, `pcm`)                                      | `src/i18n/*`, `next.config.ts`                                        | done, `pcm` is a draft (D-008)                           |
| Sentry (off until a DSN is set; scrubs PII)                         | `src/instrumentation*.ts`, `src/lib/observability`                    | done                                                     |
| Env validation, fail fast at boot                                   | `src/server/env.schema.ts`, `src/server/env.ts`                       | done                                                     |
| Supabase clients (user, service)                                    | `src/server/db/*`                                                     | done                                                     |
| Feature-flag table + helper                                         | migration `…_feature_flags.sql`, `src/server/flags.ts`                | done, applied                                            |
| `/api/health` with DB connectivity                                  | `src/app/api/health/route.ts`                                         | done (needs `SUPABASE_SERVICE_ROLE_KEY`)                 |
| `/help/emergency` static page                                       | `src/app/help/emergency/page.tsx`                                     | done (112 only, D-009)                                   |
| Style page with brand tokens                                        | `/style`                                                              | done                                                     |
| CI: grants, format, lint, typecheck, tests, build, audit            | `.github/workflows/ci.yml`                                            | done                                                     |
| `check-migration-grants`                                            | `scripts/check-migration-grants.ts`                                   | done                                                     |
| Supabase local + staging projects                                   | —                                                                     | **not done**: single project by founder decision (D-005) |

### Acceptance (§21.4)

- [x] `pnpm build` passes (locally; CI runs on push).
- [ ] `/api/health` reports DB connectivity: works, once `SUPABASE_SERVICE_ROLE_KEY` is in `.env` / Vercel.
- [x] A style page shows the brand tokens: `/style`.
- [x] External steps are tracked below.

### External steps (founder)

| Step                                                                             | Needed for                                   | Status          |
| -------------------------------------------------------------------------------- | -------------------------------------------- | --------------- |
| CAC registration                                                                 | Credits, Meta verification, Termii sender ID | not started     |
| Meta Business verification + WhatsApp number                                     | M6, M10                                      | not started     |
| Termii sender ID                                                                 | SMS (phone OTP, fallbacks)                   | not started     |
| Lawyer / DPO engagement                                                          | §17 compliance, LEGAL items                  | not started     |
| ID-verification vendor shortlist                                                 | M6                                           | not started     |
| Verify Akwa Ibom ambulance and support numbers by phone                          | Emergency page and card                      | not started     |
| Native Pidgin review of `src/i18n/pcm.json`                                      | Launch                                       | not started     |
| Rotate the database password (it was exposed in a dev session log on 2026-10-03) | Security                                     | **outstanding** |

## M1 — Identity

**Status:** built, awaiting founder review (2026-10-08). Oya-managed email + password auth (D-006, D-010).

| Item                                                                                          | Where                                                    | Status                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `profiles`, `user_roles`, `consents`, `channel_identities` with RLS + grants                  | `…_identity.sql`                                         | applied                                      |
| `internal.users / sessions / mfa_factors / rate_limits / audit_log`                           | `…_identity.sql`                                         | applied, no API access                       |
| Role management + account deletion functions                                                  | `…_identity_admin.sql`                                   | applied                                      |
| Supabase-compatible token signing (replaces the access token hook)                            | `src/server/auth/jwt.ts`, `src/server/db/user-client.ts` | done                                         |
| Sign-up (18+ check, consents), sign-in, sign-out                                              | `src/server/actions/auth.ts`, `/signup`, `/login`        | done                                         |
| Rate limits: sign-in 20/IP/15 min, sign-up 5/IP/h, lockout after 5 wrong passwords for 15 min | `src/server/rate-limit.ts`                               | done                                         |
| `authedAction()` wrapper (R13)                                                                | `src/server/actions/authed-action.ts`                    | done                                         |
| Settings: name, language, time zone, password, sessions, consents                             | `/app/settings`                                          | done                                         |
| Ops MFA (TOTP, replay-protected) and `aal2` gate                                              | `/ops/verify`, `requireStaff()`                          | done                                         |
| Email verification, password reset                                                            | —                                                        | **not done**: needs an email sender (SQ-001) |
| Phone OTP (`phone_otp` flag)                                                                  | —                                                        | not started (bootstrap mode)                 |

### Acceptance (§21.4)

- [~] Sign-in works end-to-end: yes on the production build locally (17/17 browser checks). "On staging with a real
  Nigerian number" doesn't apply to email sign-in; staging deploy pending.
- [x] Rate limits are enforced (tested): integration test + browser lockout check.
- [x] One user can't read another's profile: proven with signed tokens against the live database (13/13 integration
      checks; D-012 explains why not pgTAP).
- [x] The hook's grants are tested: the hook is replaced by token signing; tests prove server-only functions and the
      `internal` schema are unreachable with a user token.

### Founder steps

- Make yourself admin (after signing up at `/signup`):
  `select public.auth_set_role(public.auth_find_user('you@example.com'), 'admin', null);`
  then open `/ops` and set up two-factor sign-in.
- Keep `.secrets/supabase-signing-key.json` somewhere safe (a password manager) and delete it from the laptop. The
  server copy is in `.env`.
- Add `SUPABASE_JWT_SIGNING_KEY` and `APP_ENCRYPTION_KEY` to Vercel when deploying.

## M2 — Core data model and task engine

**Status:** built, awaiting founder review (2026-10-15). Eight migrations applied to the live project, all additive.

| Item                                                                                                      | Where                                | Status                         |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------ |
| Areas (PostGIS), places, saved places, `resolve_area`, `upsert_area`                                      | `…_core_areas.sql`                   | applied                        |
| Providers (column grants, public view), members, services, requests, check-ins, `nearby_providers`        | `…_core_providers.sql`               | applied                        |
| Conversations, messages, media, safety events, tasks, events, options, confirmations, checklists, shares  | `…_core_conversations_tasks.sql`     | applied, realtime on 3 tables  |
| `transition_task`, status guard trigger, `task_timer_valid`, leases, confirmations, provider access       | same                                 | applied                        |
| Power reports and status (§5.1 algorithm), local alerts, demand signals                                   | `…_core_local_data.sql`              | applied                        |
| Reminders, watches (10 active, 4 fires/day), push, notifications, KB, ratings, flags, disputes, ops queue | `…_core_reminders_trust.sql`         | applied                        |
| Jobs, webhook events, heartbeats, LLM calls and breaker, web lookups, analytics, pg_cron tick             | `…_core_internal_jobs.sql`           | applied                        |
| Task engine with retries, transition table mirrored in TypeScript                                         | `src/server/tasks/*`                 | done                           |
| Job runner, handlers (task timers, power recompute), webhook ingest                                       | `src/server/jobs/*`                  | done                           |
| Tick endpoint (202 + `after()`, batches of 10, 50 s budget, reaper, heartbeat)                            | `src/app/api/internal/tick/route.ts` | done                           |
| Area import                                                                                               | `scripts/import-areas.ts`            | done, no areas imported yet    |
| Seed data                                                                                                 | —                                    | **not done** by design (D-018) |
| Payments, refunds, guarantee claims, price reports                                                        | —                                    | Phase 1b/2 (D-016)             |

### Acceptance (§21.4)

- [~] Every table and access function is tested: 25 integration checks against the live database (D-012 explains why not
  pgTAP) cover tasks, events, confirmations, leases, jobs, webhooks, provider contact reveal and power reports. Not yet
  covered: watches, reminders, KB, ops tables (they get their tests with the milestones that write them).
- [x] Every allowed transition works and every illegal one is rejected, in Postgres and in TypeScript (a unit test
      fails if the two tables drift).
- [~] A 2-minute timer fires within 2 minutes: due timers are picked up and run (tested). The live trigger needs the
  app deployed and the Vault secrets set (below).
- [x] Killing a tick mid-run causes no duplicate side effects (tested: claim, kill, reap, re-run, late finish refused).
- [ ] `supabase db reset` reproduces a dev DB: not possible against the shared live project (D-005, D-018).

### Founder steps

- Generate a cron secret (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`), add it
  as `OYA_CRON_SECRET` in Vercel, then in the Supabase SQL editor:
  `select vault.create_secret('https://<your-domain>/api/internal/tick', 'oya_tick_url');`
  `select vault.create_secret('<the same secret>', 'oya_cron_secret');`
- Map Uyo power clusters as GeoJSON and import them:
  `pnpm tsx scripts/import-areas.ts clusters.geojson --source ambassadors-2026-11 --dry-run`, then without `--dry-run`.

## M3 — Conversation core and eval harness

**Status:** built, awaiting founder review (2026-10-15). Model provider: Groq free tier (D-019).

| Item                                                                                   | Where                                                         | Status                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------- |
| Chat UI: sidebar, centred empty state, bubbles, checked-sentence streaming, cards      | `/app`, `src/components/chat/*`, `src/components/app/Sidebar` | done                                    |
| `/api/chat` (NDJSON stream) and the web pipeline, steps 0–12                           | `src/app/api/chat`, `src/server/agent/pipeline.ts`            | done (D-020 for the gaps)               |
| Emergency pre-filter in browser and server; offline card; header Emergency button      | `config/emergency-phrases.json`, `src/lib/safety/*`           | done                                    |
| Router (structured output), safety gate, self-harm supportive flow, PII redaction      | `src/server/agent/router*.ts`, `safety-gate.ts`, `redact.ts`  | done                                    |
| Skill runner with a stub skill (`paperwork`, KB-only)                                  | `src/server/agent/skill-runner.ts`, `skills/`                 | done (D-022)                            |
| Tool registry with logging; confirmations (§7.6); Confirm-card taps                    | `src/server/agent/tools/*`, `confirmations.ts`                | done                                    |
| Cards: `InfoCard`, `ConfirmCard`, `EmergencyCard` (+ `SupportCard`); grounding checker | `src/types/cards.ts`, `cards.ts`, `grounding.ts`              | done                                    |
| LLM module: routing config, prices, retries, fallback, breaker, cost logging, budgets  | `src/server/integrations/llm/*`, `config/llm-*.json`          | done; Gemini fallback wired, off        |
| CI rule tying `enabled` / `fallbackEnabled` to eval reports                            | `scripts/check-llm-routing.ts`, CI step                       | done                                    |
| Ops queue page: filter, take over (agent pauses), hand back                            | `/ops`, `src/server/actions/ops.ts`                           | done                                    |
| Eval runner and fixtures: 100 router utterances, 110-case safety suite                 | `scripts/eval.ts`, `evals/fixtures/*`                         | done; fixtures are a team draft (D-023) |
| Service worker: emergency page offline                                                 | `public/sw.js`                                                | done (D-021)                            |
| Account-data purge (LLM logs, analytics, rate limits, safety events)                   | migration `…_purge_user_data.sql`                             | applied                                 |

### Acceptance (§21.4)

- Router ≥ 90% on the first 100 utterances: see the eval results below.
- Emergency recall 100%: see the eval results below.
- [x] Confirmation-integrity suite passes: 22/22 (`tests/integration/confirmation-integrity.test.ts`: double taps,
      expired, superseded, cross-user ids, tampered payloads, concurrent "yes", retried POSTs).
- [~] Reply first sentence ≤ 5 s p95 on staging: not measured on staging yet. Locally, against the live database from
  Nigeria-distance network, a fixed reply takes about 1–2 s and a skill reply about 5 s; most of it is database
  round trips (each turn makes ~10) plus two model calls.
- [x] The emergency card shows with the network off (browser test: typing, sending and the header button, offline).

### Founder steps

- Confirm in Groq's terms that API data isn't used for training (D-019).
- Before launch: a paid model tier; Groq's free tier serves about 3 messages a minute and 1,000 a day.
- Turn the router and safety classifier on in `config/llm-routing.json` (`"enabled": true`) once you're happy with the
  eval results; CI refuses it without a passing report. Until then production replies in button mode; set
  `LLM_ALLOW_UNEVALUATED=true` in Vercel **preview** or local `.env` to try the chat.
- Ask Pilot 0 ambassadors to write and record the real router and safety fixtures, and to review the emergency phrases.

## M4 — Power & light, local alerts, reminders & watches, notifications

**Status:** built, awaiting founder review (2026-10-18). Features are behind their flags, all **off** in the shared
project until you turn them on (D-024).

| Item                                                                                     | Where                                                               | Status                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| `power` skill: status, one-tap reports, alerts, units estimate                           | `src/server/agent/skills/power.ts`, `src/server/power/service.ts`   | done                                  |
| Power status card (Report ON/OFF, Alert me), cluster picker, few-reporters invite        | `src/components/chat/m4-cards.tsx`, `src/server/actions/power.ts`   | done                                  |
| §5.1 status algorithm, trust, bootstrap rule (from M2) and server-side reports           | migrations `…_core_local_data.sql`, `…_m4_power_reports_alerts.sql` | done, tested                          |
| `local_alerts` skill and card; alerts reach a cluster through its parent areas           | `skills/local-alerts.ts`, `src/server/alerts/service.ts`            | done                                  |
| Ops alerts editor (source URL required, verified-by, audited)                            | `/ops/alerts`                                                       | done                                  |
| Morning digest (07:00, push / in-app only, only on days with an alert)                   | `alerts_digest` job                                                 | done                                  |
| Reminders: English + Pidgin time parsing, repeats, confirm shows the parsed time         | `src/lib/reminders/parse-time.ts`, `skills/reminders.ts`            | done                                  |
| Reminder firing (tick queues due reminders; repeats move to the next occurrence), snooze | `reminder_fire` job, `enqueue_due_reminders`                        | done                                  |
| Watches: fire once per confirmed change, quiet hours, overnight opt-in, 4 a day          | `watch_eval` job + trigger on `power_status_changes`                | done                                  |
| Notifications: outbound queue with idempotency keys; web push (VAPID); in-app bell       | `src/server/notifications/*`, `NotificationBell`, `public/sw.js`    | done                                  |
| SMS (Termii) and WhatsApp adapters                                                       | `src/server/notifications/channels.ts`                              | mock mode (D-025)                     |
| Settings: power area, typical daily use, overnight alerts, digest, push on this device   | `/app/settings`                                                     | done                                  |
| Golden conversations                                                                     | —                                                                   | **waiting on model capacity** (D-027) |

### Acceptance (§21.4)

- [x] Unit tests reproduce the §5.1 rules, including spoofing: 2 new accounts can't flip a watch; bootstrap needs a
      trusted reporter; disagreement is "uncertain"; 6-hour staleness is "unknown"; trust moves +0.1 / −0.15
      (`tests/integration/m4-power-reminders.test.ts`, live database).
- [x] Watches fire once per confirmed change (replayed job sends nothing new), stay quiet overnight unless opted in,
      and fire at most 4 times a day.
- [x] Reminders fire within 1 minute: the tick queues due reminders and runs them in the same pass (tested); repeats
      move on; cancelled ones stay quiet; important ones add an SMS (mock).
- [ ] Golden conversations ≥ 85%: waiting on model capacity (D-027).

### Founder steps

- Add `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (now in `.env`) to Vercel, and `VAPID_SUBJECT` (e.g.
  `mailto:you@yourdomain`) if you want push services to have a contact.
- Turn the M4 flags on when you're ready (ops console or SQL):
  `update public.feature_flags set enabled = true where key in ('skill_power','local_alerts','reminders','watches');`
  Locally, `FLAGS_FORCE_ON=skill_power,watches,reminders,local_alerts,skill_paperwork` in `.env` does the same.
- Map and import Uyo's power clusters (`scripts/import-areas.ts`): the cluster picker and Settings show an empty state
  until areas exist.
