-- M2 (4/6): power reports and status, local alerts, demand signals (SPEC §5.1, §5.6, §5.9, §12.2–§12.4).

-- One recruited resident per cluster, reporting at ops weight (SPEC §5.1).
alter table public.areas
  add column captain_user_id uuid references internal.users (id) on delete set null;


create table public.power_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references internal.users (id) on delete set null,
  area_id uuid not null references public.areas (id) on delete cascade,
  status text not null check (status in ('on', 'off')),
  source text not null check (source in ('user', 'ops', 'disco', 'missed_call')),
  -- 'button' = a WhatsApp "Is it the same for you?" reply, weighted 0.5 (SPEC §5.1).
  via text not null default 'app' check (via in ('app', 'button', 'ops_console')),
  weight_at_report numeric(3, 2) not null check (weight_at_report between 0 and 2),
  reported_at timestamptz not null default now(),
  -- false when ignored by the algorithm (account < 24h old, or trust < 0.3).
  counted boolean not null,
  -- Set after a confirmed change: did this report agree with the consensus? Feeds reporter trust.
  matched_consensus boolean
);

create index power_reports_area_reported_idx on public.power_reports (area_id, reported_at desc);
create index power_reports_reporter_idx on public.power_reports (reporter_user_id, reported_at desc) where reporter_user_id is not null;

-- No direct access (SPEC §12.3): writes through submit_power_report(), reads from power_status.
alter table public.power_reports enable row level security;
revoke all on table public.power_reports from anon, authenticated;
grant select, insert, update, delete on table public.power_reports to service_role;


create table public.power_status (
  area_id uuid primary key references public.areas (id) on delete cascade,
  status text not null default 'unknown' check (status in ('on', 'off', 'uncertain', 'unknown')),
  confidence numeric(4, 3) not null default 0 check (confidence between 0 and 1),
  -- The last *confirmed* on/off: what a change is measured against, and what fires watches.
  confirmed_status text check (confirmed_status is null or confirmed_status in ('on', 'off')),
  last_change_at timestamptz,
  reporters_count integer not null default 0 check (reporters_count >= 0),
  computed_at timestamptz not null default now()
);

alter table public.power_status enable row level security;
revoke all on table public.power_status from anon, authenticated;
grant select on table public.power_status to anon, authenticated;
grant select, insert, update, delete on table public.power_status to service_role;

create policy "anyone reads power status" on public.power_status
for select to anon, authenticated
using (true);


create table public.power_status_changes (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas (id) on delete cascade,
  from_status text check (from_status is null or from_status in ('on', 'off')),
  to_status text not null check (to_status in ('on', 'off')),
  changed_at timestamptz not null default now(),
  reporter_ids uuid[] not null default '{}'
);

create index power_status_changes_area_idx on public.power_status_changes (area_id, changed_at desc);

alter table public.power_status_changes enable row level security;
revoke all on table public.power_status_changes from anon, authenticated;
grant select on table public.power_status_changes to authenticated;
grant select, insert, update, delete on table public.power_status_changes to service_role;

create policy "staff read power history" on public.power_status_changes
for select to authenticated
using ((select public.is_staff()));


-- Ops-entered from verified sources only; never AI-generated (SPEC §5.6).
create table public.local_alerts (
  id uuid primary key default gen_random_uuid(),
  area_ids uuid[] not null check (cardinality(area_ids) between 1 and 200),
  title text not null check (char_length(btrim(title)) between 1 and 140),
  body text not null check (char_length(body) <= 2000),
  severity text not null default 'info' check (severity in ('info', 'warning', 'severe')),
  source_url text not null check (source_url ~ '^https?://' and char_length(source_url) <= 1000),
  verified_by uuid not null references internal.users (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ends_after_start check (ends_at is null or ends_at > starts_at)
);

create index local_alerts_area_ids_idx on public.local_alerts using gin (area_ids);
create index local_alerts_window_idx on public.local_alerts (starts_at, ends_at);

create trigger local_alerts_set_updated_at before update on public.local_alerts
for each row execute function public.set_updated_at();

alter table public.local_alerts enable row level security;
revoke all on table public.local_alerts from anon, authenticated;
grant select on table public.local_alerts to anon, authenticated;
grant select, insert, update, delete on table public.local_alerts to service_role;

create policy "anyone reads local alerts" on public.local_alerts
for select to anon, authenticated
using (true);


-- Everyday needs with no skill yet; feeds the roadmap (SPEC §5.9).
create table public.demand_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references internal.users (id) on delete set null,
  area_id uuid references public.areas (id) on delete set null,
  raw_intent text not null check (char_length(raw_intent) <= 500),
  inferred_category text check (inferred_category is null or char_length(inferred_category) <= 80),
  created_at timestamptz not null default now()
);

create index demand_signals_created_idx on public.demand_signals (created_at desc);

alter table public.demand_signals enable row level security;
revoke all on table public.demand_signals from anon, authenticated;
grant select on table public.demand_signals to authenticated;
grant select, insert, update, delete on table public.demand_signals to service_role;

create policy "staff read demand signals" on public.demand_signals
for select to authenticated
using ((select public.is_staff()));


-- ---------------------------------------------------------------------------
-- compute_power_status (SPEC §5.1)
-- ---------------------------------------------------------------------------

-- Returns {status, confidence, reporters_count, changed, change_id, from_status, to_status}.
-- `changed` is true only for a confirmed change; that's what the server uses to fire watches.
create function public.compute_power_status(p_area_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bootstrap boolean := coalesce((select f.enabled from public.feature_flags f where f.key = 'bootstrap_mode'), false);
  v_on numeric := 0;
  v_off numeric := 0;
  v_sum numeric;
  v_status text;
  v_confidence numeric := 0;
  v_reporters integer := 0;
  v_last_any timestamptz;
  v_prev public.power_status;
  v_confirm boolean := false;
  v_n integer;
  v_max_weight numeric;
  v_authoritative boolean;
  v_reporter_ids uuid[];
  v_change uuid;
begin
  -- Serialise computations per area so two reports can't both "confirm" the same change.
  perform pg_advisory_xact_lock(hashtextextended('power_status:' || p_area_id::text, 0));

  select * into v_prev from public.power_status where area_id = p_area_id;

  select
    coalesce(sum(r.weight_at_report * exp(-extract(epoch from now() - r.reported_at) / 60 / 45)) filter (where r.status = 'on'), 0),
    coalesce(sum(r.weight_at_report * exp(-extract(epoch from now() - r.reported_at) / 60 / 45)) filter (where r.status = 'off'), 0),
    count(distinct coalesce(r.reporter_user_id, r.id))
  into v_on, v_off, v_reporters
  from public.power_reports r
  where r.area_id = p_area_id and r.counted and r.reported_at > now() - interval '90 minutes';

  select max(r.reported_at) into v_last_any
  from public.power_reports r
  where r.area_id = p_area_id and r.counted;

  v_sum := v_on + v_off;
  if v_last_any is null or v_last_any < now() - interval '6 hours' then
    v_status := 'unknown';
  elsif v_sum >= 1.5 and greatest(v_on, v_off) / v_sum >= 0.7 then
    v_status := case when v_on >= v_off then 'on' else 'off' end;
    v_confidence := round(greatest(v_on, v_off) / v_sum, 3);
  else
    v_status := 'uncertain';
    if v_sum > 0 then
      v_confidence := round(greatest(v_on, v_off) / v_sum, 3);
    end if;
  end if;

  -- Confirmed change: differs from the last confirmed status and enough agreement in the last 30 minutes.
  if v_status in ('on', 'off') and v_status is distinct from v_prev.confirmed_status then
    select
      count(distinct coalesce(r.reporter_user_id, r.id)),
      coalesce(max(r.weight_at_report), 0),
      bool_or(r.source in ('ops', 'disco') or r.weight_at_report >= 2.0),
      array_remove(array_agg(distinct r.reporter_user_id), null)
    into v_n, v_max_weight, v_authoritative, v_reporter_ids
    from public.power_reports r
    where r.area_id = p_area_id and r.counted and r.status = v_status and r.reported_at > now() - interval '30 minutes';

    v_confirm := coalesce(v_authoritative, false)
      or (v_n >= 2 and v_max_weight >= 1.0)
      or (v_n >= 3 and (not v_bootstrap or v_max_weight >= 1.0));
  end if;

  insert into public.power_status (area_id, status, confidence, confirmed_status, last_change_at, reporters_count, computed_at)
  values (
    p_area_id, v_status, v_confidence,
    case when v_confirm then v_status else v_prev.confirmed_status end,
    case when v_confirm then now() else v_prev.last_change_at end,
    v_reporters, now()
  )
  on conflict (area_id) do update set
    status = excluded.status,
    confidence = excluded.confidence,
    confirmed_status = excluded.confirmed_status,
    last_change_at = excluded.last_change_at,
    reporters_count = excluded.reporters_count,
    computed_at = excluded.computed_at;

  if v_confirm then
    insert into public.power_status_changes (area_id, from_status, to_status, reporter_ids)
    values (p_area_id, v_prev.confirmed_status, v_status, coalesce(v_reporter_ids, '{}'))
    returning id into v_change;

    -- Mark the window's user reports as agreeing or not with the consensus.
    update public.power_reports r
    set matched_consensus = (r.status = v_status)
    where r.area_id = p_area_id and r.counted and r.source = 'user' and r.matched_consensus is null
      and r.reported_at > now() - interval '90 minutes';

    -- Trust: +0.1 for agreeing (cap 1.0), −0.15 for disagreeing (floor 0.2). Captains and ops keep theirs.
    update public.profiles p
    set reporter_trust = case
      when x.agreed then least(1.0, p.reporter_trust + 0.1)
      else greatest(0.2, p.reporter_trust - 0.15)
    end
    from (
      select r.reporter_user_id as user_id, bool_or(r.status = v_status) as agreed
      from public.power_reports r
      where r.area_id = p_area_id and r.counted and r.source = 'user' and r.reporter_user_id is not null
        and r.reported_at > now() - interval '90 minutes'
      group by r.reporter_user_id
    ) x
    where p.id = x.user_id and p.reporter_trust < 2.0;

    -- Reporters who disagree > 60% of the time over 10+ judged reports drop to 0.2.
    update public.profiles p
    set reporter_trust = 0.2
    from (
      select r.reporter_user_id as user_id
      from public.power_reports r
      where r.reporter_user_id is not null and r.matched_consensus is not null
        and r.reporter_user_id = any (
          select distinct r2.reporter_user_id from public.power_reports r2
          where r2.area_id = p_area_id and r2.reported_at > now() - interval '90 minutes' and r2.reporter_user_id is not null
        )
      group by r.reporter_user_id
      having count(*) >= 10 and avg(case when r.matched_consensus then 0 else 1 end) > 0.6
    ) bad
    where p.id = bad.user_id and p.reporter_trust < 2.0;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'confidence', v_confidence,
    'reporters_count', v_reporters,
    'changed', v_confirm,
    'change_id', v_change,
    'from_status', v_prev.confirmed_status,
    'to_status', case when v_confirm then v_status end
  );
end;
$$;

revoke execute on function public.compute_power_status(uuid) from public, anon, authenticated;
grant execute on function public.compute_power_status(uuid) to service_role;


-- Shared insert path. Weight rules (SPEC §5.1, §20.1):
--   ops / disco / cluster captain 2.0; WhatsApp button replies 0.5;
--   otherwise reporter_trust, capped at 0.3 in bootstrap mode until ops confirm the phone.
-- Reports from accounts younger than 24 hours, or with trust < 0.3, are stored but not counted.
create function public.record_power_report(
  p_area_id uuid,
  p_status text,
  p_source text,
  p_reporter_user_id uuid,
  p_via text default 'app'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bootstrap boolean := coalesce((select f.enabled from public.feature_flags f where f.key = 'bootstrap_mode'), false);
  v_area public.areas;
  v_profile public.profiles;
  v_user_created timestamptz;
  v_weight numeric;
  v_counted boolean;
  v_id uuid;
begin
  select * into v_area from public.areas where id = p_area_id;
  if not found or v_area.kind <> 'power_cluster' or not v_area.active then
    raise exception 'not an active power cluster' using errcode = '22023';
  end if;

  if p_source in ('ops', 'disco') then
    v_weight := 2.0;
    v_counted := true;
  else
    if p_reporter_user_id is null then
      raise exception 'a % report needs a reporter', p_source using errcode = '22023';
    end if;
    select * into v_profile from public.profiles where id = p_reporter_user_id;
    select u.created_at into v_user_created from internal.users u where u.id = p_reporter_user_id;
    if v_profile.id is null or v_user_created is null then
      raise exception 'reporter not found' using errcode = 'P0002';
    end if;

    if v_area.captain_user_id = p_reporter_user_id then
      v_weight := 2.0;
    elsif p_via = 'button' then
      v_weight := 0.5;
    elsif v_bootstrap and v_profile.phone_verified_by_ops_at is null then
      v_weight := least(v_profile.reporter_trust, 0.3);
    else
      v_weight := least(v_profile.reporter_trust, 2.0);
    end if;

    v_counted := v_user_created <= now() - interval '24 hours' and v_profile.reporter_trust >= 0.3;
    if v_area.captain_user_id = p_reporter_user_id then
      v_counted := true;
    end if;
  end if;

  insert into public.power_reports (reporter_user_id, area_id, status, source, via, weight_at_report, counted)
  values (p_reporter_user_id, p_area_id, p_status, p_source, p_via, v_weight, v_counted)
  returning id into v_id;

  return jsonb_build_object('report_id', v_id, 'counted', v_counted) || public.compute_power_status(p_area_id);
end;
$$;

revoke execute on function public.record_power_report(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_power_report(uuid, text, text, uuid, text) to service_role;


-- The signed-in user's one-tap report (SPEC §5.1, §12.4). Area defaults to the profile's power cluster;
-- another cluster is allowed only if it's one of the user's saved places.
-- At most one report per user per cluster per 10 minutes, and 20 per hour overall.
-- Returns {result: 'recorded' | 'too_soon' | 'rate_limited' | 'no_cluster', ...compute result}.
create function public.submit_power_report(p_status text, p_area_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_area uuid;
begin
  if v_uid is null then
    raise exception 'sign in to report' using errcode = '42501';
  end if;
  if p_status not in ('on', 'off') then
    raise exception 'status must be on or off' using errcode = '22023';
  end if;

  v_area := coalesce(p_area_id, (select p.power_area_id from public.profiles p where p.id = v_uid));
  if v_area is null then
    return jsonb_build_object('result', 'no_cluster');
  end if;
  if p_area_id is not null
     and p_area_id is distinct from (select p.power_area_id from public.profiles p where p.id = v_uid)
     and not exists (select 1 from public.saved_places s where s.user_id = v_uid and s.area_id = p_area_id) then
    raise exception 'you can report only for your own cluster or a saved place' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.power_reports r
    where r.reporter_user_id = v_uid and r.area_id = v_area and r.reported_at > now() - interval '10 minutes'
  ) then
    return jsonb_build_object('result', 'too_soon');
  end if;

  if not public.hit_rate_limit('power_report:' || v_uid::text, 3600, 20) then
    return jsonb_build_object('result', 'rate_limited');
  end if;

  return jsonb_build_object('result', 'recorded')
    || public.record_power_report(v_area, p_status, 'user', v_uid, 'app');
end;
$$;

revoke execute on function public.submit_power_report(text, uuid) from public, anon;
grant execute on function public.submit_power_report(text, uuid) to authenticated, service_role;


-- SPEC §12.3 names the consent `share_contact`; M2 (3/6) checked a different name.
create or replace function public.provider_get_request(p_request_id uuid)
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
        and 'share_contact' = any (c.consents)
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
