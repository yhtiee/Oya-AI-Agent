-- M2 (3/6): conversations, messages, media, safety events, tasks and the task state machine
-- (SPEC §7.2, §7.6, §8, §12.2–§12.4).

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  channel text not null check (channel in ('web', 'whatsapp', 'telegram', 'sms')),
  last_message_at timestamptz,
  -- Per-conversation processing lease (SPEC §7.2 step 0).
  processing_by text,
  processing_until timestamptz,
  -- Self-harm support mode (SPEC §7.9).
  support_mode_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_idx on public.conversations (user_id, last_message_at desc);

create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;
revoke all on table public.conversations from anon, authenticated;
grant select on table public.conversations to authenticated;
grant select, insert, update, delete on table public.conversations to service_role;

create policy "users read their own conversations" on public.conversations
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff()));


create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  skill_id text not null check (skill_id in ('power', 'paperwork', 'get_help', 'artisans', 'food', 'local_alerts', 'reminders', 'web_answers')),
  job_type text not null check (job_type in ('know', 'get_done', 'book', 'find', 'remember', 'get_help', 'buy_pay')),
  status text not null default 'draft' check (status in (
    'draft', 'needs_info', 'confirming', 'awaiting_responses', 'options_ready', 'booked', 'awaiting_payment',
    'in_progress', 'awaiting_confirmation', 'completed', 'disputed', 'cancelled', 'failed', 'expired'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  summary text check (summary is null or char_length(summary) <= 500),
  slots jsonb not null default '{}'::jsonb check (jsonb_typeof(slots) = 'object'),
  location extensions.geography(Point, 4326),
  area_id uuid references public.areas (id) on delete set null,
  budget_kobo bigint check (budget_kobo is null or budget_kobo >= 0),
  chosen_option_id uuid,
  provider_id uuid references public.providers (id) on delete set null,
  scheduled_for timestamptz,
  expected_end_at timestamptz,
  visit_in_home boolean not null default false,
  pin_released_at timestamptz,
  agreed_price_kobo bigint check (agreed_price_kobo is null or agreed_price_kobo >= 0),
  completed_at timestamptz,
  closed_at timestamptz,
  outcome text check (outcome is null or outcome in (
    'sorted', 'auto_completed', 'no_supply', 'user_cancelled', 'provider_cancelled', 'no_show', 'expired',
    'failed_other', 'dispute_upheld', 'dispute_rejected'
  )),
  outcome_reason text check (outcome_reason is null or char_length(outcome_reason) <= 500),
  version integer not null default 1,
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  assigned_ops_id uuid references internal.users (id) on delete set null,
  agent_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.tasks.status is 'Changes only through transition_task() (SPEC §8.2).';

create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_status_updated_idx on public.tasks (status, updated_at);
create index tasks_location_idx on public.tasks using gist (location);
create index tasks_provider_idx on public.tasks (provider_id) where provider_id is not null;

create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
revoke all on table public.tasks from anon, authenticated;
grant select on table public.tasks to authenticated;
grant select, insert, update, delete on table public.tasks to service_role;

create policy "users read their own tasks" on public.tasks
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff()));

-- Status changes must go through transition_task(), even for the service role.
create function public.tasks_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and coalesce(current_setting('oya.transitioning', true), '') <> 'on' then
    raise exception 'tasks.status changes only through transition_task()' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.tasks_guard_status() from public, anon, authenticated;

create trigger tasks_guard_status before update of status on public.tasks
for each row execute function public.tasks_guard_status();

alter table public.provider_requests
  add constraint provider_requests_task_id_fkey foreign key (task_id) references public.tasks (id) on delete cascade;
alter table public.provider_check_ins
  add constraint provider_check_ins_task_id_fkey foreign key (task_id) references public.tasks (id) on delete cascade;


create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'provider', 'ops', 'system')),
  channel text not null check (channel in ('web', 'whatsapp', 'telegram', 'sms')),
  text text check (text is null or char_length(text) <= 8000),
  cards jsonb not null default '[]'::jsonb check (jsonb_typeof(cards) = 'array'),
  external_message_id text,
  status text not null default 'received' check (status in ('received', 'sent', 'delivered', 'read', 'failed')),
  retention_class text not null default 'standard' check (retention_class in ('standard', 'health')),
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  unique (channel, external_message_id)
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_task_idx on public.messages (task_id) where task_id is not null;

alter table public.messages enable row level security;
revoke all on table public.messages from anon, authenticated;
grant select on table public.messages to authenticated;
grant select, insert, update, delete on table public.messages to service_role;

create policy "users read messages in their conversations" on public.messages
for select to authenticated
using (
  exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))
  or (select public.is_staff())
);


create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references internal.users (id) on delete cascade,
  owner_provider_id uuid references public.providers (id) on delete cascade,
  bucket text not null check (bucket in ('media', 'provider-photos', 'public-assets')),
  path text not null check (char_length(path) <= 500),
  mime text not null check (char_length(mime) <= 100),
  bytes integer check (bytes is null or bytes >= 0),
  duration_sec numeric(7, 2),
  transcript text,
  transcript_language text,
  transcript_confidence numeric(4, 3) check (transcript_confidence is null or transcript_confidence between 0 and 1),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket, path),
  constraint media_has_one_owner check (num_nonnulls(owner_user_id, owner_provider_id) <= 1)
);

alter table public.media enable row level security;
revoke all on table public.media from anon, authenticated;
grant select on table public.media to authenticated;
grant select, insert, update, delete on table public.media to service_role;

create policy "users read their own media" on public.media
for select to authenticated
using (owner_user_id = (select auth.uid()) or (select public.is_staff()));


create table public.message_media (
  message_id uuid not null references public.messages (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  position smallint not null default 0,
  primary key (message_id, media_id)
);

alter table public.message_media enable row level security;
revoke all on table public.message_media from anon, authenticated;
grant select on table public.message_media to authenticated;
grant select, insert, update, delete on table public.message_media to service_role;

create policy "users read attachments on their messages" on public.message_media
for select to authenticated
using (
  exists (
    select 1 from public.messages m join public.conversations c on c.id = m.conversation_id
    where m.id = message_id and c.user_id = (select auth.uid())
  )
  or (select public.is_staff())
);


-- Admin only (SPEC §12.3). Self-harm text is kept 7 days (SPEC §17.4).
create table public.safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references internal.users (id) on delete set null,
  kind text not null check (kind in ('emergency', 'self_harm', 'home_visit_alert', 'prohibited')),
  task_id uuid references public.tasks (id) on delete set null,
  text_excerpt text check (text_excerpt is null or (kind = 'self_harm' and char_length(text_excerpt) <= 2000)),
  handled_by uuid references internal.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create index safety_events_created_idx on public.safety_events (created_at desc);

alter table public.safety_events enable row level security;
revoke all on table public.safety_events from anon, authenticated;
grant select on table public.safety_events to authenticated;
grant select, insert, update, delete on table public.safety_events to service_role;

create policy "admins read safety events" on public.safety_events
for select to authenticated
using ((select public.is_admin()));


-- Append-only timeline. Users see only visibility = 'user' rows of their own tasks (SPEC §12.3).
create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  -- Strict ordering for timer validity checks (SPEC §8.3).
  seq bigint generated always as identity,
  task_id uuid not null references public.tasks (id) on delete cascade,
  type text not null check (type in ('status_change', 'tool_call', 'user_confirmed', 'provider_reply', 'ops_note', 'notification', 'payment', 'step')),
  visibility text not null default 'user' check (visibility in ('user', 'ops')),
  from_status text,
  to_status text,
  actor_type text not null check (actor_type in ('user', 'agent', 'provider', 'ops', 'system')),
  actor_id uuid,
  -- Redacted and display-safe when visibility = 'user'.
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint internal_event_types_are_ops_only check (type not in ('tool_call', 'ops_note') or visibility = 'ops'),
  constraint status_changes_have_statuses check (type <> 'status_change' or (from_status is not null and to_status is not null))
);

create unique index task_events_seq_key on public.task_events (seq);
create index task_events_task_idx on public.task_events (task_id, created_at);
create index task_events_task_seq_idx on public.task_events (task_id, seq);

alter table public.task_events enable row level security;
revoke all on table public.task_events from anon, authenticated;
grant select on table public.task_events to authenticated;
grant select, insert on table public.task_events to service_role;

create policy "users read visible events on their tasks" on public.task_events
for select to authenticated
using (
  (visibility = 'user' and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())))
  or (select public.is_staff())
);


create table public.task_options (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  provider_id uuid references public.providers (id) on delete set null,
  google_place_id text,
  facility_id uuid references public.providers (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  price_kobo bigint check (price_kobo is null or price_kobo >= 0),
  price_note text check (price_note is null or char_length(price_note) <= 200),
  eta_minutes integer check (eta_minutes is null or eta_minutes between 0 and 10080),
  ready_at timestamptz,
  distance_m integer check (distance_m is null or distance_m >= 0),
  source text not null check (source in ('provider_reply', 'provider_listing', 'places', 'kb', 'facility_list')),
  as_of timestamptz not null,
  valid_until timestamptz,
  rank numeric(6, 4),
  rank_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(rank_reasons) = 'array'),
  status text not null default 'available' check (status in ('available', 'chosen', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index task_options_task_idx on public.task_options (task_id, status);
create unique index task_options_one_per_provider on public.task_options (task_id, provider_id) where provider_id is not null and status <> 'withdrawn';

create trigger task_options_set_updated_at before update on public.task_options
for each row execute function public.set_updated_at();

alter table public.task_options enable row level security;
revoke all on table public.task_options from anon, authenticated;
grant select on table public.task_options to authenticated;
grant select, insert, update, delete on table public.task_options to service_role;

create policy "users read options on their tasks" on public.task_options
for select to authenticated
using (
  exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
  or (select public.is_staff())
);

alter table public.tasks
  add constraint tasks_chosen_option_id_fkey foreign key (chosen_option_id) references public.task_options (id)
  on delete set null deferrable initially deferred;


create table public.confirmations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  user_id uuid not null references internal.users (id) on delete cascade,
  kind text not null check (kind in ('fanout', 'booking', 'reschedule', 'cancel', 'share_booking', 'payment', 'reminder', 'watch', 'preference', 'save_place')),
  summary_text text not null check (char_length(summary_text) <= 1000),
  -- The exact validated tool call; executed by the server, never re-generated (SPEC §7.6).
  action_payload jsonb not null check (jsonb_typeof(action_payload) = 'object'),
  consents text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'expired', 'superseded')),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One pending confirmation per conversation, so a "yes" is never ambiguous (SPEC §7.6).
create unique index confirmations_one_pending_per_conversation on public.confirmations (conversation_id) where status = 'pending';
create index confirmations_task_idx on public.confirmations (task_id) where task_id is not null;

create trigger confirmations_set_updated_at before update on public.confirmations
for each row execute function public.set_updated_at();

alter table public.confirmations enable row level security;
revoke all on table public.confirmations from anon, authenticated;
grant select on table public.confirmations to authenticated;
grant select, insert, update, delete on table public.confirmations to service_role;

create policy "users read their own confirmations" on public.confirmations
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff()));


create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  kb_slug text,
  kb_version integer,
  position smallint not null default 0,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index task_checklist_items_task_idx on public.task_checklist_items (task_id, position);

alter table public.task_checklist_items enable row level security;
revoke all on table public.task_checklist_items from anon, authenticated;
grant select on table public.task_checklist_items to authenticated;
grant select, insert, update, delete on table public.task_checklist_items to service_role;

create policy "users read checklists on their tasks" on public.task_checklist_items
for select to authenticated
using (
  exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
  or (select public.is_staff())
);


-- View-only booking share page /s/[token] (SPEC §15.7). Server access only.
create table public.booking_shares (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  contact_phone_e164 text not null check (contact_phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.booking_shares enable row level security;
revoke all on table public.booking_shares from anon, authenticated;
grant select, insert, update, delete on table public.booking_shares to service_role;


-- ---------------------------------------------------------------------------
-- State machine (SPEC §8.2)
-- ---------------------------------------------------------------------------

-- The allowed transitions, exactly as §8.2. Mirrored in src/server/tasks/transitions.ts; a test checks they agree.
create function public.task_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_from, p_to) in (
    ('draft', 'needs_info'), ('draft', 'confirming'), ('draft', 'options_ready'), ('draft', 'completed'),
    ('draft', 'failed'), ('draft', 'cancelled'),
    ('needs_info', 'confirming'), ('needs_info', 'options_ready'), ('needs_info', 'failed'),
    ('needs_info', 'cancelled'), ('needs_info', 'expired'),
    ('confirming', 'awaiting_responses'), ('confirming', 'booked'), ('confirming', 'needs_info'),
    ('confirming', 'options_ready'), ('confirming', 'failed'), ('confirming', 'cancelled'), ('confirming', 'expired'),
    ('awaiting_responses', 'awaiting_responses'), ('awaiting_responses', 'options_ready'),
    ('awaiting_responses', 'booked'), ('awaiting_responses', 'failed'), ('awaiting_responses', 'cancelled'),
    ('options_ready', 'confirming'), ('options_ready', 'awaiting_responses'), ('options_ready', 'failed'),
    ('options_ready', 'cancelled'), ('options_ready', 'expired'),
    ('booked', 'awaiting_payment'), ('booked', 'in_progress'), ('booked', 'awaiting_confirmation'),
    ('booked', 'options_ready'), ('booked', 'awaiting_responses'), ('booked', 'cancelled'), ('booked', 'disputed'),
    ('awaiting_payment', 'booked'), ('awaiting_payment', 'in_progress'), ('awaiting_payment', 'options_ready'),
    ('awaiting_payment', 'cancelled'), ('awaiting_payment', 'expired'),
    ('in_progress', 'awaiting_payment'), ('in_progress', 'awaiting_confirmation'), ('in_progress', 'cancelled'),
    ('in_progress', 'disputed'),
    ('awaiting_confirmation', 'completed'), ('awaiting_confirmation', 'disputed'),
    ('completed', 'disputed'),
    ('disputed', 'completed'), ('disputed', 'cancelled'), ('disputed', 'failed')
  );
$$;

revoke execute on function public.task_transition_allowed(text, text) from public, anon;
grant execute on function public.task_transition_allowed(text, text) to authenticated, service_role;


-- Moves a task to a new status (SPEC §8.2):
--  - checks the transition table and the version (optimistic concurrency);
--  - raises 40001 (serialization_failure) on a version mismatch, so callers re-read and retry;
--  - raises 22023 on an illegal transition;
--  - bumps version, sets completed_at / closed_at / outcome, and writes a status_change event.
create function public.transition_task(
  p_task_id uuid,
  p_to text,
  p_expected_version integer,
  p_actor_type text,
  p_actor_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_outcome text default null,
  p_outcome_reason text default null,
  p_visibility text default 'user'
)
returns table (task_id uuid, from_status text, to_status text, version integer, event_id uuid, event_seq bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks;
  v_event uuid;
  v_seq bigint;
  v_terminal constant text[] := array['cancelled', 'failed', 'expired'];
begin
  select * into v_task from public.tasks t where t.id = p_task_id for update;
  if not found then
    raise exception 'task % not found', p_task_id using errcode = 'P0002';
  end if;

  if v_task.version <> p_expected_version then
    raise exception 'task % is at version %, expected %', p_task_id, v_task.version, p_expected_version
      using errcode = '40001';
  end if;

  if not public.task_transition_allowed(v_task.status, p_to) then
    raise exception 'illegal transition % -> % for task %', v_task.status, p_to, p_task_id using errcode = '22023';
  end if;

  if v_task.status = 'completed' and p_to = 'disputed'
     and (v_task.completed_at is null or v_task.completed_at < now() - interval '72 hours') then
    raise exception 'the dispute window for task % has closed', p_task_id using errcode = '22023';
  end if;

  if p_to = any (v_terminal) and p_outcome is null then
    raise exception 'entering % needs an outcome', p_to using errcode = '22023';
  end if;

  perform set_config('oya.transitioning', 'on', true);
  update public.tasks t set
    status = p_to,
    version = t.version + 1,
    completed_at = case when p_to = 'completed' then coalesce(t.completed_at, now()) else t.completed_at end,
    closed_at = case when p_to = any (v_terminal) then now() else t.closed_at end,
    outcome = coalesce(p_outcome, t.outcome),
    outcome_reason = coalesce(p_outcome_reason, t.outcome_reason)
  where t.id = p_task_id;
  perform set_config('oya.transitioning', 'off', true);

  insert into public.task_events (task_id, type, visibility, from_status, to_status, actor_type, actor_id, payload)
  values (p_task_id, 'status_change', p_visibility, v_task.status, p_to, p_actor_type, p_actor_id, coalesce(p_payload, '{}'::jsonb))
  returning id, seq into v_event, v_seq;

  return query select p_task_id, v_task.status, p_to, v_task.version + 1, v_event, v_seq;
end;
$$;

revoke execute on function public.transition_task(uuid, text, integer, text, uuid, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.transition_task(uuid, text, integer, text, uuid, jsonb, text, text, text) to service_role;


-- A timer may act only if the task is still in one of its statuses *and* hasn't left them since the
-- status_change that scheduled it, so leaving and re-entering a status never revives an old timer (SPEC §8.3).
create function public.task_timer_valid(p_task_id uuid, p_anchor_event_id uuid, p_valid_statuses text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tasks t where t.id = p_task_id and t.status = any (p_valid_statuses))
     and not exists (
       select 1 from public.task_events e
       where e.task_id = p_task_id
         and e.type = 'status_change'
         and e.seq > (select a.seq from public.task_events a where a.id = p_anchor_event_id)
         and not (e.to_status = any (p_valid_statuses))
     )
     and exists (select 1 from public.task_events a where a.id = p_anchor_event_id and a.task_id = p_task_id);
$$;

revoke execute on function public.task_timer_valid(uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.task_timer_valid(uuid, uuid, text[]) to service_role;


-- ---------------------------------------------------------------------------
-- Conversation lease (SPEC §7.2 step 0) and confirmations (SPEC §7.6)
-- ---------------------------------------------------------------------------

-- Claims or extends the lease. Returns true if this worker now holds it.
create function public.claim_conversation_lease(p_conversation_id uuid, p_worker_id text, p_ttl_s integer default 60)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.conversations
    set processing_by = p_worker_id, processing_until = now() + make_interval(secs => p_ttl_s)
    where id = p_conversation_id
      and (processing_until is null or processing_until < now() or processing_by = p_worker_id)
    returning id
  )
  select exists (select 1 from claimed);
$$;

revoke execute on function public.claim_conversation_lease(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.claim_conversation_lease(uuid, text, integer) to service_role;

create function public.release_conversation_lease(p_conversation_id uuid, p_worker_id text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with released as (
    update public.conversations
    set processing_by = null, processing_until = null
    where id = p_conversation_id and processing_by = p_worker_id
    returning id
  )
  select exists (select 1 from released);
$$;

revoke execute on function public.release_conversation_lease(uuid, text) from public, anon, authenticated;
grant execute on function public.release_conversation_lease(uuid, text) to service_role;


-- Creates a pending confirmation, superseding any other pending one in the conversation, atomically.
create function public.create_confirmation(
  p_conversation_id uuid,
  p_task_id uuid,
  p_user_id uuid,
  p_kind text,
  p_summary_text text,
  p_action_payload jsonb,
  p_consents text[] default '{}',
  p_ttl_s integer default 1800
)
returns setof public.confirmations
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.confirmations set status = 'superseded'
  where conversation_id = p_conversation_id and status = 'pending';

  return query
  insert into public.confirmations (conversation_id, task_id, user_id, kind, summary_text, action_payload, consents, expires_at)
  values (p_conversation_id, p_task_id, p_user_id, p_kind, p_summary_text, p_action_payload, coalesce(p_consents, '{}'),
          now() + make_interval(secs => p_ttl_s))
  returning *;
end;
$$;

revoke execute on function public.create_confirmation(uuid, uuid, uuid, text, text, jsonb, text[], integer) from public, anon, authenticated;
grant execute on function public.create_confirmation(uuid, uuid, uuid, text, text, jsonb, text[], integer) to service_role;


-- Atomic pending → confirmed. Succeeds once; double taps and retries get no row (SPEC §7.6).
create function public.claim_confirmation(p_confirmation_id uuid, p_user_id uuid)
returns setof public.confirmations
language sql
security definer
set search_path = ''
as $$
  update public.confirmations
  set status = 'confirmed', confirmed_at = now()
  where id = p_confirmation_id and user_id = p_user_id and status = 'pending' and expires_at > now()
  returning *;
$$;

revoke execute on function public.claim_confirmation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_confirmation(uuid, uuid) to service_role;


-- ---------------------------------------------------------------------------
-- Provider access to requests (SPEC §12.3)
-- ---------------------------------------------------------------------------

-- Contact details (first name, phone) are revealed only when this provider was chosen, the task is booked or
-- later, the user confirmed a booking with share-contact consent, and it's within 30 days of completion.
-- The exact pin additionally needs a non-home visit or a released pin (meet at the gate, SPEC §15.7).
create function public.provider_get_request(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.provider_requests;
  t public.tasks;
  v_reveal boolean;
  v_pin boolean;
  v_first_name text;
  v_phone text;
begin
  select * into r from public.provider_requests where id = p_request_id;
  if not found or not exists (
    select 1 from public.provider_members m where m.provider_id = r.provider_id and m.user_id = auth.uid()
  ) then
    return null;
  end if;

  select * into t from public.tasks where id = r.task_id;

  v_reveal := t.provider_id = r.provider_id
    and t.status in ('booked', 'in_progress', 'awaiting_payment', 'awaiting_confirmation', 'completed', 'disputed')
    and exists (
      select 1 from public.confirmations c
      where c.task_id = t.id and c.kind = 'booking' and c.status = 'confirmed'
        and 'share_contact_on_booking' = any (c.consents)
    )
    and now() < coalesce(t.completed_at, t.closed_at, now() + interval '1 year') + interval '30 days';

  v_pin := v_reveal and (not t.visit_in_home or t.pin_released_at is not null);

  if v_reveal then
    select split_part(p.display_name, ' ', 1), p.phone_e164 into v_first_name, v_phone
    from public.profiles p where p.id = t.user_id;
  end if;

  return jsonb_build_object(
    'id', r.id,
    'kind', r.kind,
    'wave', r.wave,
    'response', r.response,
    'quote_kobo', r.quote_kobo,
    'eta_minutes', r.eta_minutes,
    'brief', r.brief,
    'task_status', t.status,
    'scheduled_for', t.scheduled_for,
    'area_name', (select a.name from public.areas a where a.id = t.area_id),
    'chosen', t.provider_id = r.provider_id,
    'contact', case when v_reveal then jsonb_build_object('first_name', v_first_name, 'phone', v_phone) end,
    'pin', case when v_pin then jsonb_build_object(
      'lat', extensions.st_y(t.location::extensions.geometry),
      'lng', extensions.st_x(t.location::extensions.geometry)
    ) end
  );
end;
$$;

revoke execute on function public.provider_get_request(uuid) from public, anon;
grant execute on function public.provider_get_request(uuid) to authenticated, service_role;


-- The caller's providers' requests, newest first, always in the redacted form.
create function public.provider_list_requests()
returns table (
  id uuid, provider_id uuid, kind text, wave integer, response text, brief jsonb, task_status text,
  scheduled_for timestamptz, area_name text, chosen boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.provider_id, r.kind, r.wave, r.response, r.brief, t.status, t.scheduled_for,
         (select a.name from public.areas a where a.id = t.area_id), t.provider_id = r.provider_id, r.created_at
  from public.provider_requests r
  join public.tasks t on t.id = r.task_id
  where r.provider_id in (select m.provider_id from public.provider_members m where m.user_id = auth.uid())
  order by r.created_at desc
  limit 200;
$$;

revoke execute on function public.provider_list_requests() from public, anon;
grant execute on function public.provider_list_requests() to authenticated, service_role;


-- Realtime for the live task panel and replies sent outside the open request (SPEC §12.3).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.task_events, public.task_options, public.messages;
  end if;
end;
$$;
