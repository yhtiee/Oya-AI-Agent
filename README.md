# Oya

The AI agent for everyday life. Starting in Nigeria, built for everywhere.

The product and technical specification is [`SPEC.md`](SPEC.md). Build progress is in
[`docs/milestones.md`](docs/milestones.md), choices the spec doesn't cover are in
[`docs/decisions.md`](docs/decisions.md), and open divergences are in [`docs/spec-questions.md`](docs/spec-questions.md).

## Setup

Requirements: Node.js 22+, pnpm 11 (`npm i -g pnpm`), and the Supabase CLI via `npx supabase` (log in with
`npx supabase login`).

```bash
pnpm install
cp .env.example .env    # then fill in the Supabase values
pnpm dev                # http://localhost:3000
```

Useful pages while developing:

- `/` the landing page
- `/style` brand tokens, type scale and components
- `/help/emergency` the static emergency page
- `/api/health` app and database health

## Scripts

| Command                                        | What it does                                                    |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `pnpm dev` / `pnpm build` / `pnpm start`       | Next.js                                                         |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Code quality                                                    |
| `pnpm test` / `pnpm test:coverage`             | Unit tests (Vitest)                                             |
| `pnpm check:grants`                            | Fails any migration missing RLS or explicit grants (SPEC §12.1) |
| `pnpm db:push`                                 | Apply new migrations to the linked Supabase project             |
| `pnpm db:types`                                | Regenerate `src/types/db.ts` from the database                  |

## Layout

```
src/app          routes: (marketing) landing, /help/emergency, /style, /api/*
src/server       server-only code: env, db clients, flags, actions, safety
src/components   ui (restyled Radix/shadcn), marketing
src/lib          money, phone, time, utils, marketing data
src/i18n         next-intl config and en / pcm catalogues
config           brand tokens, emergency resources
supabase         migrations
scripts          check-migration-grants
docs             decisions, spec questions, milestones
```

## Rules worth knowing before you write code

From SPEC §0.1, the short version:

- Money is integer kobo (`bigint`), never floats. Use `src/lib/money.ts`.
- Every new table needs RLS, policies and explicit `GRANT`s in the same migration; every function needs
  `revoke execute … from public`. CI enforces this.
- The service-role client lives in `src/server/db/service-client.ts` and is only used after an ownership check.
- Features for later phases ship behind `feature_flags`. GATED flags can't be enabled without a `gate_note`.
