-- M2 (6/6): durable jobs, webhook intake, heartbeats, LLM logging and breaker, web lookups, analytics
-- (SPEC §9, §10.1a, §12.2 internal schema, §12.4).
--
-- `internal` isn't exposed through the Data API, so server code reaches these tables through the
-- public functions below, each granted to service_role only (docs/decisions.md D-014).

create table internal.jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'process_inbound', 'resume_turn', 'task_timer', 'send_outbound', 'reminder_fire', 'watch_eval',
    'power_status_recompute', 'provider_daily_menu', 'kb_freshness_check', 'cost_report', 'retention_purge',
    'account_deletion', 'reconcile_payments', 'llm_breaker_check', 'deferred_message', 'backup_dump'
  )),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  run_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'dead')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  locked_at timestamptz,
  locked_by text,
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  dedupe_key text unique check (dedupe_key is null or char_length(dedupe_key) <= 300),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index jobs_status_run_at_idx on internal.jobs (status, run_at);
create index jobs_running_locked_idx on internal.jobs (locked_at) where status = 'running';

alter table internal.jobs enable row level security;
revoke all on table internal.jobs from public, anon, authenticated;
grant select, insert, update, delete on table internal.jobs to service_role;


create table internal.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('whatsapp', 'telegram', 'sms', 'paystack', 'verification', 'other')),
  external_id text not null check (char_length(external_id) <= 300),
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  job_id uuid references internal.jobs (id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (source, external_id)
);

alter table internal.webhook_events enable row level security;
revoke all on table internal.webhook_events from public, anon, authenticated;
grant select, insert, update, delete on table internal.webhook_events to service_role;


create table internal.heartbeats (
  name text primary key check (char_length(name) <= 60),
  at timestamptz not null default now()
);

alter table internal.heartbeats enable row level security;
revoke all on table internal.heartbeats from public, anon, authenticated;
grant select, insert, update, delete on table internal.heartbeats to service_role;


-- Tokens and cost only, never message content (R11).
create table internal.llm_calls (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('anthropic', 'google', 'openai', 'other')),
  model text not null check (char_length(model) <= 100),
  purpose text not null check (char_length(purpose) <= 60),
  status text not null check (status in ('ok', 'error', 'timeout', 'content_filtered')),
  fallback_from text check (fallback_from is null or char_length(fallback_from) <= 100),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens integer not null default 0 check (cache_write_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  web_search_requests integer not null default 0 check (web_search_requests >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  task_id uuid,
  user_id uuid,
  created_at timestamptz not null default now()
);

create index llm_calls_created_idx on internal.llm_calls (created_at desc);
create index llm_calls_provider_created_idx on internal.llm_calls (provider, created_at desc);
create index llm_calls_task_idx on internal.llm_calls (task_id) where task_id is not null;
create index llm_calls_user_created_idx on internal.llm_calls (user_id, created_at desc) where user_id is not null;

alter table internal.llm_calls enable row level security;
revoke all on table internal.llm_calls from public, anon, authenticated;
grant select, insert on table internal.llm_calls to service_role;


create table internal.llm_breaker (
  provider text primary key check (provider in ('anthropic', 'google', 'openai', 'other')),
  state text not null default 'closed' check (state in ('closed', 'open', 'half_open')),
  opened_at timestamptz,
  open_until timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  consecutive_ok integer not null default 0 check (consecutive_ok >= 0),
  updated_at timestamptz not null default now()
);

alter table internal.llm_breaker enable row level security;
revoke all on table internal.llm_breaker from public, anon, authenticated;
grant select, insert, update, delete on table internal.llm_breaker to service_role;


-- No user or conversation id (SPEC §12.2).
create table internal.web_lookups (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('web_answer', 'kb_gap')),
  topic text not null check (char_length(topic) <= 60),
  -- null when the topic is sensitive
  question_redacted text check (question_redacted is null or char_length(question_redacted) <= 500),
  normalised_key text not null check (char_length(normalised_key) <= 200),
  area_id uuid,
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  search_count smallint not null default 0 check (search_count between 0 and 5),
  official boolean not null default false,
  helpful boolean,
  cost_usd numeric(8, 5) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index web_lookups_key_area_created_idx on internal.web_lookups (normalised_key, area_id, created_at);

alter table internal.web_lookups enable row level security;
revoke all on table internal.web_lookups from public, anon, authenticated;
grant select, insert, update, delete on table internal.web_lookups to service_role;


-- Aggregate, no user data. area_id uses the nil uuid for "no area" because it's part of the key.
create table internal.web_question_counts (
  normalised_key text not null check (char_length(normalised_key) <= 200),
  area_id uuid not null,
  day date not null,
  lookups integer not null default 0 check (lookups >= 0),
  primary key (normalised_key, area_id, day)
);

alter table internal.web_question_counts enable row level security;
revoke all on table internal.web_question_counts from public, anon, authenticated;
grant select, insert, update, delete on table internal.web_question_counts to service_role;


create table internal.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null check (name ~ '^[a-z][a-z0-9_.]{0,79}$'),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object'),
  created_at timestamptz not null default now()
);

create index analytics_events_name_created_idx on internal.analytics_events (name, created_at desc);

alter table internal.analytics_events enable row level security;
revoke all on table internal.analytics_events from public, anon, authenticated;
grant select, insert, delete on table internal.analytics_events to service_role;


-- ---------------------------------------------------------------------------
-- Jobs (SPEC §9)
-- ---------------------------------------------------------------------------

-- Inserts a job; a repeated dedupe key is a no-op. Returns the job id (the existing one for a duplicate)
-- and whether this call created it.
create function public.enqueue_job(
  p_type text,
  p_payload jsonb default '{}'::jsonb,
  p_run_at timestamptz default null,
  p_dedupe_key text default null,
  p_max_attempts integer default 5
)
returns table (id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into internal.jobs (type, payload, run_at, dedupe_key, max_attempts)
  values (p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_run_at, now()), p_dedupe_key, p_max_attempts)
  on conflict (dedupe_key) do nothing
  returning internal.jobs.id into v_id;

  if v_id is not null then
    return query select v_id, true;
  else
    return query select j.id, false from internal.jobs j where j.dedupe_key = p_dedupe_key;
  end if;
end;
$$;

revoke execute on function public.enqueue_job(text, jsonb, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.enqueue_job(text, jsonb, timestamptz, text, integer) to service_role;


create function public.claim_jobs(p_worker text, p_limit integer default 10)
returns setof internal.jobs
language sql
security definer
set search_path = ''
as $$
  update internal.jobs
  set status = 'running', locked_at = now(), locked_by = p_worker, attempts = attempts + 1
  where id in (
    select j.id from internal.jobs j
    where j.status = 'queued' and j.run_at <= now()
    order by j.run_at
    limit greatest(1, least(p_limit, 50))
    for update skip locked
  )
  returning *;
$$;

revoke execute on function public.claim_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.claim_jobs(text, integer) to service_role;


-- Claims one job for inline processing (SPEC §7.2). No row if another worker has it or it's done.
create function public.claim_job_by_id(p_id uuid, p_worker text)
returns setof internal.jobs
language sql
security definer
set search_path = ''
as $$
  update internal.jobs
  set status = 'running', locked_at = now(), locked_by = p_worker, attempts = attempts + 1
  where id = (
    select j.id from internal.jobs j
    where j.id = p_id and j.status = 'queued' and j.run_at <= now()
    for update skip locked
  )
  returning *;
$$;

revoke execute on function public.claim_job_by_id(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_job_by_id(uuid, text) to service_role;


-- Only the worker holding the lock can finish a job, so a reaped-and-reclaimed job isn't finished twice.
create function public.complete_job(p_id uuid, p_worker text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with done as (
    update internal.jobs
    set status = 'done', finished_at = now(), locked_at = null, last_error = null
    where id = p_id and status = 'running' and locked_by = p_worker
    returning id
  )
  select exists (select 1 from done);
$$;

revoke execute on function public.complete_job(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_job(uuid, text) to service_role;


-- Backoff 30 s, 2 min, 10 min, 1 h, 6 h; dead after max_attempts. Returns the new status, or null if this
-- worker no longer holds the job.
create function public.fail_job(p_id uuid, p_worker text, p_error text, p_retry boolean default true)
returns text
language sql
security definer
set search_path = ''
as $$
  update internal.jobs
  set status = case when not p_retry or attempts >= max_attempts then 'dead' else 'queued' end,
      run_at = now() + (array['30 seconds', '2 minutes', '10 minutes', '1 hour', '6 hours']::interval[])[least(greatest(attempts, 1), 5)],
      locked_at = null,
      locked_by = null,
      last_error = left(p_error, 2000),
      finished_at = case when not p_retry or attempts >= max_attempts then now() end
  where id = p_id and status = 'running' and locked_by = p_worker
  returning status;
$$;

revoke execute on function public.fail_job(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.fail_job(uuid, text, text, boolean) to service_role;


-- Jobs running for more than 5 minutes go back to the queue (or die if out of attempts).
create function public.reap_jobs(p_stale_after_s integer default 300)
returns integer
language sql
security definer
set search_path = ''
as $$
  with reaped as (
    update internal.jobs
    set status = case when attempts >= max_attempts then 'dead' else 'queued' end,
        locked_at = null,
        locked_by = null,
        last_error = 'reaped: still running after ' || p_stale_after_s || 's',
        finished_at = case when attempts >= max_attempts then now() end
    where status = 'running' and locked_at < now() - make_interval(secs => p_stale_after_s)
    returning id
  )
  select count(*)::integer from reaped;
$$;

revoke execute on function public.reap_jobs(integer) from public, anon, authenticated;
grant execute on function public.reap_jobs(integer) to service_role;


create function public.record_heartbeat(p_name text)
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  insert into internal.heartbeats (name, at) values (p_name, now())
  on conflict (name) do update set at = excluded.at
  returning at;
$$;

revoke execute on function public.record_heartbeat(text) from public, anon, authenticated;
grant execute on function public.record_heartbeat(text) to service_role;


-- For /api/health and the ops console: tick freshness and queue depth.
create function public.jobs_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tick_at', (select h.at from internal.heartbeats h where h.name = 'tick'),
    'queued_due', (select count(*) from internal.jobs j where j.status = 'queued' and j.run_at <= now()),
    'running', (select count(*) from internal.jobs j where j.status = 'running'),
    'dead_24h', (select count(*) from internal.jobs j where j.status = 'dead' and j.finished_at > now() - interval '24 hours')
  );
$$;

revoke execute on function public.jobs_overview() from public, anon, authenticated;
grant execute on function public.jobs_overview() to service_role;


-- Atomic webhook event + process_inbound job (SPEC §7.2). A retried delivery returns duplicate = true.
create function public.ingest_webhook(p_source text, p_external_id text, p_payload jsonb)
returns table (event_id uuid, job_id uuid, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_job uuid;
begin
  insert into internal.webhook_events (source, external_id)
  values (p_source, p_external_id)
  on conflict (source, external_id) do nothing
  returning id into v_event;

  if v_event is null then
    return query select e.id, e.job_id, true from internal.webhook_events e
      where e.source = p_source and e.external_id = p_external_id;
    return;
  end if;

  insert into internal.jobs (type, payload, dedupe_key)
  values ('process_inbound', jsonb_build_object('source', p_source, 'webhook_event_id', v_event, 'event', p_payload),
          'webhook:' || p_source || ':' || p_external_id)
  returning id into v_job;

  update internal.webhook_events set job_id = v_job where id = v_event;
  return query select v_event, v_job, false;
end;
$$;

revoke execute on function public.ingest_webhook(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_webhook(text, text, jsonb) to service_role;


-- ---------------------------------------------------------------------------
-- LLM calls and circuit breaker (SPEC §10.1a)
-- ---------------------------------------------------------------------------

create function public.log_llm_call(p_call jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into internal.llm_calls (
    provider, model, purpose, status, fallback_from, input_tokens, cache_read_tokens, cache_write_tokens,
    output_tokens, web_search_requests, cost_micros, latency_ms, task_id, user_id
  )
  values (
    p_call ->> 'provider', p_call ->> 'model', p_call ->> 'purpose', p_call ->> 'status', p_call ->> 'fallback_from',
    coalesce((p_call ->> 'input_tokens')::integer, 0), coalesce((p_call ->> 'cache_read_tokens')::integer, 0),
    coalesce((p_call ->> 'cache_write_tokens')::integer, 0), coalesce((p_call ->> 'output_tokens')::integer, 0),
    coalesce((p_call ->> 'web_search_requests')::integer, 0), coalesce((p_call ->> 'cost_micros')::bigint, 0),
    (p_call ->> 'latency_ms')::integer, (p_call ->> 'task_id')::uuid, (p_call ->> 'user_id')::uuid
  )
  returning id;
$$;

revoke execute on function public.log_llm_call(jsonb) from public, anon, authenticated;
grant execute on function public.log_llm_call(jsonb) to service_role;


-- Records one outcome and returns the breaker state after it:
--  closed:    5 consecutive failures → open for 10 minutes;
--  open:      becomes half_open once open_until passes;
--  half_open: a failed probe re-opens; 5 probe successes in a row close it.
create function public.llm_breaker_record(p_provider text, p_ok boolean, p_probe boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  b internal.llm_breaker;
begin
  insert into internal.llm_breaker (provider) values (p_provider) on conflict (provider) do nothing;
  select * into b from internal.llm_breaker where provider = p_provider for update;

  if b.state = 'open' and b.open_until <= now() then
    b.state := 'half_open';
    b.consecutive_ok := 0;
  end if;

  if p_ok then
    b.consecutive_failures := 0;
    b.consecutive_ok := b.consecutive_ok + 1;
    if b.state = 'half_open' and p_probe and b.consecutive_ok >= 5 then
      b.state := 'closed';
      b.opened_at := null;
      b.open_until := null;
    end if;
  else
    b.consecutive_failures := b.consecutive_failures + 1;
    b.consecutive_ok := 0;
    if (b.state = 'half_open' and p_probe) or (b.state = 'closed' and b.consecutive_failures >= 5) then
      b.state := 'open';
      b.opened_at := now();
      b.open_until := now() + interval '10 minutes';
    end if;
  end if;

  update internal.llm_breaker set
    state = b.state, opened_at = b.opened_at, open_until = b.open_until,
    consecutive_failures = b.consecutive_failures, consecutive_ok = b.consecutive_ok, updated_at = now()
  where provider = p_provider;

  return b.state;
end;
$$;

revoke execute on function public.llm_breaker_record(text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.llm_breaker_record(text, boolean, boolean) to service_role;


-- The tick's check: open any closed breaker with ≥ 20 calls and ≥ 50% failures in the last 5 minutes.
-- Also moves expired open breakers to half_open. Returns the current states.
create function public.llm_breaker_check()
returns table (provider text, state text, open_until timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into internal.llm_breaker (provider)
  select distinct c.provider from internal.llm_calls c where c.created_at > now() - interval '5 minutes'
  on conflict do nothing;

  update internal.llm_breaker b
  set state = 'open', opened_at = now(), open_until = now() + interval '10 minutes', consecutive_ok = 0, updated_at = now()
  from (
    select c.provider, count(*) as n, count(*) filter (where c.status <> 'ok') as failed
    from internal.llm_calls c
    where c.created_at > now() - interval '5 minutes'
    group by c.provider
  ) s
  where b.provider = s.provider and b.state = 'closed' and s.n >= 20 and s.failed * 2 >= s.n;

  update internal.llm_breaker b
  set state = 'half_open', consecutive_ok = 0, updated_at = now()
  where b.state = 'open' and b.open_until <= now();

  return query select b.provider, b.state, b.open_until from internal.llm_breaker b order by b.provider;
end;
$$;

revoke execute on function public.llm_breaker_check() from public, anon, authenticated;
grant execute on function public.llm_breaker_check() to service_role;


create function public.llm_breaker_states()
returns table (provider text, state text, open_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.provider, b.state, b.open_until from internal.llm_breaker b order by b.provider;
$$;

revoke execute on function public.llm_breaker_states() from public, anon, authenticated;
grant execute on function public.llm_breaker_states() to service_role;


-- ---------------------------------------------------------------------------
-- Web lookups (SPEC §5.10, §12.4) and analytics
-- ---------------------------------------------------------------------------

-- Inserts the lookup, bumps today's count, and returns whether this lookup took the question
-- to 8 lookups in 30 days (the kb_gap threshold), exactly once.
create function public.record_web_lookup(p_lookup jsonb)
returns table (lookup_id uuid, crossed_threshold boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_key text := p_lookup ->> 'normalised_key';
  v_area uuid := coalesce((p_lookup ->> 'area_id')::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
  v_before integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('web_lookup:' || v_key || ':' || v_area::text, 0));

  select coalesce(sum(c.lookups), 0) into v_before
  from internal.web_question_counts c
  where c.normalised_key = v_key and c.area_id = v_area and c.day > (now() at time zone 'Africa/Lagos')::date - 30;

  insert into internal.web_lookups (purpose, topic, question_redacted, normalised_key, area_id, citations, search_count, official, cost_usd)
  values (
    p_lookup ->> 'purpose', p_lookup ->> 'topic', p_lookup ->> 'question_redacted', v_key,
    (p_lookup ->> 'area_id')::uuid, coalesce(p_lookup -> 'citations', '[]'::jsonb),
    coalesce((p_lookup ->> 'search_count')::smallint, 0), coalesce((p_lookup ->> 'official')::boolean, false),
    coalesce((p_lookup ->> 'cost_usd')::numeric, 0)
  )
  returning id into v_id;

  insert into internal.web_question_counts (normalised_key, area_id, day, lookups)
  values (v_key, v_area, (now() at time zone 'Africa/Lagos')::date, 1)
  on conflict (normalised_key, area_id, day) do update set lookups = internal.web_question_counts.lookups + 1;

  return query select v_id, v_before < 8 and v_before + 1 >= 8;
end;
$$;

revoke execute on function public.record_web_lookup(jsonb) from public, anon, authenticated;
grant execute on function public.record_web_lookup(jsonb) to service_role;


create function public.track_event(p_user_id uuid, p_name text, p_props jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into internal.analytics_events (user_id, name, props) values (p_user_id, p_name, coalesce(p_props, '{}'::jsonb));
$$;

revoke execute on function public.track_event(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.track_event(uuid, text, jsonb) to service_role;


-- ---------------------------------------------------------------------------
-- Tick trigger: pg_cron every minute → pg_net POST to {APP_URL}/api/internal/tick (SPEC §9).
-- URL and secret live in Vault (names oya_tick_url, oya_cron_secret, and optionally
-- oya_vercel_bypass for protected previews). Until they're set, the trigger does nothing.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create function internal.trigger_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_bypass text;
  v_headers jsonb;
begin
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'oya_tick_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'oya_cron_secret';
  select s.decrypted_secret into v_bypass from vault.decrypted_secrets s where s.name = 'oya_vercel_bypass';
  if v_url is null or v_secret is null then
    return null;
  end if;

  v_headers := jsonb_build_object('content-type', 'application/json', 'x-oya-cron-secret', v_secret);
  if v_bypass is not null then
    v_headers := v_headers || jsonb_build_object('x-vercel-protection-bypass', v_bypass);
  end if;

  return net.http_post(url := v_url, body := '{}'::jsonb, headers := v_headers, timeout_milliseconds := 5000);
end;
$$;

revoke execute on function internal.trigger_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'oya-tick') then
    perform cron.unschedule('oya-tick');
  end if;
  perform cron.schedule('oya-tick', '* * * * *', 'select internal.trigger_tick()');
end;
$$;
