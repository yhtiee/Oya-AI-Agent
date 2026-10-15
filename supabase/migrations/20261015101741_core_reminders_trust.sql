-- M2 (5/6): reminders, watches, notifications, knowledge base, ratings, flags, disputes, ops queue
-- (SPEC §5.2, §5.7, §7.11, §12.2–§12.5). Money tables (payments, refunds) arrive with Phase 1b.

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text check (body is null or char_length(body) <= 1000),
  remind_at timestamptz not null,
  -- RFC 5545 RRULE, validated on the server (SPEC §5.7).
  rrule text check (rrule is null or char_length(rrule) <= 300),
  important boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled', 'failed')),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_due_idx on public.reminders (remind_at) where status = 'scheduled';
create index reminders_user_idx on public.reminders (user_id, status);

create trigger reminders_set_updated_at before update on public.reminders
for each row execute function public.set_updated_at();

alter table public.reminders enable row level security;
revoke all on table public.reminders from anon, authenticated;
grant select on table public.reminders to authenticated;
grant select, insert, update, delete on table public.reminders to service_role;

create policy "users read their own reminders" on public.reminders
for select to authenticated
using (user_id = (select auth.uid()));


create table public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  type text not null check (type in ('power_on', 'power_off', 'provider_available', 'price_below', 'fuel_available')),
  area_id uuid references public.areas (id) on delete cascade,
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  active boolean not null default true,
  fires_today integer not null default 0 check (fires_today between 0 and 4),
  fires_day date,
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index watches_area_type_idx on public.watches (area_id, type) where active;
create index watches_user_idx on public.watches (user_id) where active;

create trigger watches_set_updated_at before update on public.watches
for each row execute function public.set_updated_at();

-- Max 10 active watches per user (SPEC §5.7).
create function public.watches_limit_active()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.active and (tg_op = 'INSERT' or not old.active) then
    perform pg_advisory_xact_lock(hashtextextended('watches:' || new.user_id::text, 0));
    if (select count(*) from public.watches w where w.user_id = new.user_id and w.active and w.id <> new.id) >= 10 then
      raise exception 'at most 10 active watches' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.watches_limit_active() from public, anon, authenticated;

create trigger watches_limit_active before insert or update of active on public.watches
for each row execute function public.watches_limit_active();

alter table public.watches enable row level security;
revoke all on table public.watches from anon, authenticated;
grant select on table public.watches to authenticated;
grant select, insert, update, delete on table public.watches to service_role;

create policy "users read their own watches" on public.watches
for select to authenticated
using (user_id = (select auth.uid()));

-- Claims one firing for a watch: at most 4 a day (Africa/Lagos), atomically. provider_available ends the watch.
create function public.claim_watch_fire(p_watch_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.watches w
    set fires_today = case when w.fires_day = (now() at time zone 'Africa/Lagos')::date then w.fires_today + 1 else 1 end,
        fires_day = (now() at time zone 'Africa/Lagos')::date,
        last_fired_at = now(),
        active = w.type <> 'provider_available'
    where w.id = p_watch_id and w.active
      and (w.fires_day is distinct from (now() at time zone 'Africa/Lagos')::date or w.fires_today < 4)
    returning w.id
  )
  select exists (select 1 from claimed);
$$;

revoke execute on function public.claim_watch_fire(uuid) from public, anon, authenticated;
grant execute on function public.claim_watch_fire(uuid) to service_role;


create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  last_ok_at timestamptz,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
grant select on table public.push_subscriptions to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

create policy "users read their own push subscriptions" on public.push_subscriptions
for select to authenticated
using (user_id = (select auth.uid()));


create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references internal.users (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete cascade,
  channel text not null check (channel in ('push', 'whatsapp', 'sms', 'telegram', 'email')),
  template_key text not null check (char_length(template_key) <= 80),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  external_id text,
  idempotency_key text not null unique check (char_length(idempotency_key) <= 200),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  error text check (error is null or char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_have_a_recipient check (num_nonnulls(user_id, provider_id) = 1)
);

create index notifications_status_scheduled_idx on public.notifications (status, scheduled_at);
create index notifications_user_idx on public.notifications (user_id, created_at desc) where user_id is not null;
create unique index notifications_channel_external_key on public.notifications (channel, external_id) where external_id is not null;

create trigger notifications_set_updated_at before update on public.notifications
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant select, insert, update, delete on table public.notifications to service_role;

create policy "staff read notifications" on public.notifications
for select to authenticated
using ((select public.is_staff()));


-- ---------------------------------------------------------------------------
-- Knowledge base (SPEC §5.2). Content is seeded with M5 once each document is verified.
-- ---------------------------------------------------------------------------

create function public.kb_tsv(p_title text, p_aliases text[], p_one_liner text, p_body text)
returns tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(p_title, '')), 'A')
      || setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(pg_catalog.array_to_string(p_aliases, ' '), '')), 'A')
      || setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(p_one_liner, '')), 'B')
      || setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(p_body, '')), 'C');
$$;

revoke execute on function public.kb_tsv(text, text[], text, text) from public;
grant execute on function public.kb_tsv(text, text[], text, text) to anon, authenticated, service_role;

create table public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  aliases text[] not null default '{}',
  one_liner text not null check (char_length(one_liner) <= 300),
  category text not null check (char_length(category) <= 60),
  jurisdiction text not null default 'NG' check (jurisdiction in ('NG', 'NG-AK')),
  body_md text not null default '',
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  required_documents jsonb not null default '[]'::jsonb check (jsonb_typeof(required_documents) = 'array'),
  -- [{label, amount_kobo, note}]
  fees jsonb not null default '[]'::jsonb check (jsonb_typeof(fees) = 'array'),
  official_urls text[] not null default '{}',
  source_urls text[] not null default '{}',
  last_verified_at timestamptz,
  verified_by uuid references internal.users (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  tsv tsvector generated always as (public.kb_tsv(title, aliases, one_liner, body_md)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Published documents must have been verified against an official source (SPEC §5.2).
  constraint published_documents_are_verified check (
    status <> 'published' or (last_verified_at is not null and verified_by is not null and cardinality(source_urls) > 0)
  )
);

create index kb_documents_tsv_idx on public.kb_documents using gin (tsv);

create trigger kb_documents_set_updated_at before update on public.kb_documents
for each row execute function public.set_updated_at();

alter table public.kb_documents enable row level security;
revoke all on table public.kb_documents from anon, authenticated;
grant select on table public.kb_documents to anon, authenticated;
grant select, insert, update, delete on table public.kb_documents to service_role;

create policy "anyone reads published kb documents" on public.kb_documents
for select to anon, authenticated
using (status = 'published' or (select public.is_staff()));


-- ---------------------------------------------------------------------------
-- Trust and ops (SPEC §12.2, §7.11)
-- ---------------------------------------------------------------------------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  rater_user_id uuid not null references internal.users (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  tags text[] not null default '{}',
  comment text check (comment is null or char_length(comment) <= 1000),
  provider_reply text check (provider_reply is null or char_length(provider_reply) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, rater_user_id)
);

create index ratings_provider_idx on public.ratings (provider_id, created_at desc);

create trigger ratings_set_updated_at before update on public.ratings
for each row execute function public.set_updated_at();

alter table public.ratings enable row level security;
revoke all on table public.ratings from anon, authenticated;
grant select on table public.ratings to authenticated;
grant select, insert, update, delete on table public.ratings to service_role;

create policy "raters, rated providers and staff read ratings" on public.ratings
for select to authenticated
using (
  rater_user_id = (select auth.uid())
  or (select public.is_provider_member(provider_id))
  or (select public.is_staff())
);


create table public.user_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  kind text not null check (kind in ('provider_safety_complaint', 'repeated_cancellations', 'abuse')),
  source_task_id uuid references public.tasks (id) on delete set null,
  created_by uuid references internal.users (id) on delete set null,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index user_flags_user_idx on public.user_flags (user_id, created_at desc);

alter table public.user_flags enable row level security;
revoke all on table public.user_flags from anon, authenticated;
grant select on table public.user_flags to authenticated;
grant select, insert, update, delete on table public.user_flags to service_role;

create policy "staff read user flags" on public.user_flags
for select to authenticated
using ((select public.is_staff()));


create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  opened_by uuid not null references internal.users (id) on delete cascade,
  reason text not null check (reason in ('not_done', 'poor_quality', 'overcharged', 'no_show', 'damage', 'safety', 'other')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'rejected')),
  resolution text check (resolution is null or char_length(resolution) <= 2000),
  assigned_to uuid references internal.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index disputes_one_open_per_task on public.disputes (task_id) where status in ('open', 'investigating');

create trigger disputes_set_updated_at before update on public.disputes
for each row execute function public.set_updated_at();

alter table public.disputes enable row level security;
revoke all on table public.disputes from anon, authenticated;
grant select on table public.disputes to authenticated;
grant select, insert, update, delete on table public.disputes to service_role;

create policy "openers and staff read disputes" on public.disputes
for select to authenticated
using (opened_by = (select auth.uid()) or (select public.is_staff()));


create table public.ops_queue (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  -- e.g. {trade} or {dish} for invite candidates; citations for kb_gap.
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  reason text not null check (reason in (
    'no_supply', 'provider_timeout', 'user_dispute', 'safety', 'kb_gap', 'low_confidence_transcript',
    'budget_exceeded', 'tool_failure', 'verification', 'concierge_request', 'invite_candidate'
  )),
  priority smallint not null default 2 check (priority between 1 and 3),
  status text not null default 'open' check (status in ('open', 'assigned', 'done')),
  assigned_to uuid references internal.users (id) on delete set null,
  resolved_at timestamptz,
  note text check (note is null or char_length(note) <= 2000),
  google_place_id text check (google_place_id is null or char_length(google_place_id) <= 300),
  times_shown integer not null default 0 check (times_shown >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint safety_items_are_priority_one check (reason <> 'safety' or priority = 1),
  constraint invite_candidates_have_a_place check (reason <> 'invite_candidate' or google_place_id is not null)
);

create index ops_queue_open_idx on public.ops_queue (status, priority, created_at) where status <> 'done';
create index ops_queue_task_idx on public.ops_queue (task_id) where task_id is not null;
create unique index ops_queue_open_invite_candidate on public.ops_queue (google_place_id)
  where reason = 'invite_candidate' and status <> 'done';

create trigger ops_queue_set_updated_at before update on public.ops_queue
for each row execute function public.set_updated_at();

alter table public.ops_queue enable row level security;
revoke all on table public.ops_queue from anon, authenticated;
grant select on table public.ops_queue to authenticated;
grant select, insert, update, delete on table public.ops_queue to service_role;

create policy "staff read the ops queue" on public.ops_queue
for select to authenticated
using ((select public.is_staff()));


-- Upserts the open invite_candidate item for a Google place (SPEC §12.4); supabase-js can't express this.
create function public.bump_invite_candidate(p_place_id text, p_trade text, p_area_id uuid, p_priority smallint default 3)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.ops_queue (reason, google_place_id, area_id, meta, priority, times_shown)
  values ('invite_candidate', p_place_id, p_area_id, jsonb_build_object('trade', p_trade), greatest(1, least(3, p_priority)), 1)
  on conflict (google_place_id) where reason = 'invite_candidate' and status <> 'done'
  do update set
    times_shown = public.ops_queue.times_shown + 1,
    priority = least(public.ops_queue.priority, excluded.priority)
  returning id;
$$;

revoke execute on function public.bump_invite_candidate(text, text, uuid, smallint) from public, anon, authenticated;
grant execute on function public.bump_invite_candidate(text, text, uuid, smallint) to service_role;
