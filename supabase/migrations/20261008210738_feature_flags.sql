-- M0: shared updated_at trigger + feature flags (SPEC §12.1, §12.2, §20, R12).

-- Shared trigger function: every table with an updated_at column uses it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;


-- Feature flags. Read by server code with the service role; ops can read them in the console.
-- Writes go through audited server actions (M8), so there are no client write policies.
create table public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  enabled boolean not null default false,
  -- { env?: string[], user_ids?: uuid[], area_ids?: uuid[], percentage?: 0-100 } (src/server/flags/rules.ts)
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  description text not null default '',
  phase text not null default '1a' check (phase in ('1a', '1b', '2', '3', '4')),
  -- GATED features need a legal opinion, platform approval or licence before they can be switched on.
  gated boolean not null default false,
  gate_note text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gated_flags_need_a_gate_note check (not (gated and enabled and coalesce(btrim(gate_note), '') = ''))
);

comment on table public.feature_flags is 'Feature flags gating phases and GATED features (SPEC §20, R12).';

create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;

revoke all on table public.feature_flags from anon, authenticated;
grant select on table public.feature_flags to authenticated;
grant select, insert, update, delete on table public.feature_flags to service_role;

-- Ops and admins (with MFA) can read flags. app_role is added to the JWT by the access token hook (M1).
create policy "ops can read feature flags"
on public.feature_flags
for select
to authenticated
using (
  (auth.jwt() ->> 'app_role') in ('ops', 'admin')
  and (auth.jwt() ->> 'aal') = 'aal2'
);


insert into public.feature_flags (key, enabled, phase, gated, description) values
  -- Phase 1a
  ('skill_power',                 false, '1a', false, 'Power & light skill (§5.1)'),
  ('skill_paperwork',             false, '1a', false, 'Government paperwork skill (§5.2)'),
  ('skill_get_help',              false, '1a', false, 'Get help: emergencies and health facilities (§5.3)'),
  ('skill_artisans',              false, '1a', false, 'Artisans & home services (§5.4)'),
  ('skill_food',                  false, '1a', false, 'Food pickup (§5.5)'),
  ('local_alerts',                false, '1a', false, 'Ops-curated local alerts (§5.6)'),
  ('reminders',                   false, '1a', false, 'Reminders (§5.7)'),
  ('watches',                     false, '1a', false, 'Watches (§5.7)'),
  ('whatsapp_provider_channel',   false, '1a', true,  'WhatsApp templates to providers (§4.2). Gate: Meta policy review recorded.'),
  ('whatsapp_user_notifications', false, '1a', true,  'WhatsApp notification templates to users (§4.3a). Gate: Meta verification, approved templates.'),
  ('voice_notes',                 false, '1a', false, 'Voice notes, once speech evals pass (§10.6)'),
  ('web_answers',                 false, '1a', false, 'Labelled, unverified web answers (§5.10)'),
  ('kb_web_fallback',             false, '1a', false, 'Web fallback for KB gaps (§5.10)'),
  ('unverified_fallback',         false, '1a', false, 'Labelled Google Maps results when no verified provider (§5.4)'),
  ('llm_fallback',                false, '1a', false, 'Gemini fallback, once its evals pass (§10.1a)'),
  ('bootstrap_mode',              true,  '1a', false, 'Near-zero-cost configuration of Phase 1a (§20.1)'),
  ('phone_otp',                   false, '1a', false, 'Phone OTP sign-in via SMS (§4.6)'),
  -- Phase 1b
  ('payments',                    false, '1b', false, 'Paystack split payments (§11)'),
  ('telegram_channel',            false, '1b', false, 'Telegram bot (§4.4)'),
  ('visitor_mode',                false, '1b', false, 'Anonymous visitor sign-ins (§3.1)'),
  ('offline_outbox',              false, '1b', false, 'Send messages typed offline later (§14.8)'),
  ('provider_team',               false, '1b', false, 'Provider staff members (§13)'),
  ('power_typical_return',        false, '1b', false, 'Typical-return power estimates'),
  ('handoff_rides',               false, '1b', false, 'Rides handoff'),
  ('whatsapp_user_requests',      false, '1b', true,  'Requests over WhatsApp (§4.3b). Gate: written policy review.'),
  ('missed_call_reports',         false, '1b', true,  'Missed-call power reports. Gate: telephony approval.'),
  ('provider_voice_alerts',       false, '1b', true,  'Provider voice alerts. Gate: telephony approval.'),
  -- Phase 2+
  ('guarantee',                   false, '2',  false, 'Sorted guarantee'),
  ('autonomy',                    false, '2',  false, 'Autonomy levels'),
  ('provider_tools',              false, '2',  false, 'Provider tools (§13.6)'),
  ('lang_ibb',                    false, '2',  false, 'Ibibio'),
  ('voice_local_languages',       false, '2',  false, 'Voice in local languages'),
  ('group_requests',              false, '2',  false, 'Web group requests'),
  ('kb_vectors',                  false, '2',  false, 'pgvector KB search'),
  ('ai_calls',                    false, '2',  true,  'AI phone calls. Gate: legal opinion.'),
  ('escrow',                      false, '2',  true,  'Escrow. Gate: licence (R2).'),
  ('missions',                    false, '3',  false, 'Multi-step missions'),
  ('health_stock_check',          false, '3',  true,  'Medicine stock checks. Gate: PCN.'),
  ('insights',                    false, '3',  true,  'Insights. Gate: DPIA.')
on conflict (key) do nothing;
