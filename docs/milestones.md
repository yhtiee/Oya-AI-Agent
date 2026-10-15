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
