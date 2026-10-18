-- M4: server-side power reports for a known user, and active local alerts for an area (SPEC §5.1, §5.6).

-- The rules of submit_power_report, for a user the server has already authenticated (chat tools, card taps,
-- notification buttons with via = 'button' at weight 0.5). Service role only.
create function public.submit_power_report_for(
  p_user_id uuid,
  p_status text,
  p_area_id uuid default null,
  p_via text default 'app'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area uuid;
  v_home uuid := (select p.power_area_id from public.profiles p where p.id = p_user_id);
begin
  if p_user_id is null then
    raise exception 'a reporter is required' using errcode = '42501';
  end if;
  if p_status not in ('on', 'off') then
    raise exception 'status must be on or off' using errcode = '22023';
  end if;

  v_area := coalesce(p_area_id, v_home);
  if v_area is null then
    return jsonb_build_object('result', 'no_cluster');
  end if;
  if p_area_id is not null and p_area_id is distinct from v_home
     and not exists (select 1 from public.saved_places s where s.user_id = p_user_id and s.area_id = p_area_id) then
    raise exception 'you can report only for your own cluster or a saved place' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.power_reports r
    where r.reporter_user_id = p_user_id and r.area_id = v_area and r.reported_at > now() - interval '10 minutes'
  ) then
    return jsonb_build_object('result', 'too_soon');
  end if;

  if not public.hit_rate_limit('power_report:' || p_user_id::text, 3600, 20) then
    return jsonb_build_object('result', 'rate_limited');
  end if;

  return jsonb_build_object('result', 'recorded', 'area_id', v_area)
    || public.record_power_report(v_area, p_status, 'user', p_user_id, p_via);
end;
$$;

revoke execute on function public.submit_power_report_for(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_power_report_for(uuid, text, uuid, text) to service_role;

-- The user-facing RPC keeps its contract and now shares the rules above.
create or replace function public.submit_power_report(p_status text, p_area_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in to report' using errcode = '42501';
  end if;
  return public.submit_power_report_for(auth.uid(), p_status, p_area_id, 'app');
end;
$$;

revoke execute on function public.submit_power_report(text, uuid) from public, anon;
grant execute on function public.submit_power_report(text, uuid) to authenticated, service_role;


-- An area and every area containing it (cluster → neighbourhood → LGA → state → country).
create function public.area_ancestors(p_area_id uuid)
returns table (id uuid, name text, kind text, depth integer)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive up as (
    select a.id, a.name, a.kind, a.parent_id, 0 as depth from public.areas a where a.id = p_area_id
    union all
    select a.id, a.name, a.kind, a.parent_id, up.depth + 1 from public.areas a join up on a.id = up.parent_id
    where up.depth < 10
  )
  select up.id, up.name, up.kind, up.depth from up;
$$;

revoke execute on function public.area_ancestors(uuid) from public;
grant execute on function public.area_ancestors(uuid) to anon, authenticated, service_role;


-- Alerts posted for an area or any area containing it, current or starting within `p_ahead_hours`, soonest first.
create function public.local_alerts_for_area(p_area_id uuid, p_ahead_hours integer default 72)
returns setof public.local_alerts
language sql
stable
security definer
set search_path = ''
as $$
  select l.*
  from public.local_alerts l
  where l.area_ids && (select coalesce(array_agg(a.id), '{}') from public.area_ancestors(p_area_id) a)
    and l.starts_at <= now() + make_interval(hours => p_ahead_hours)
    and (l.ends_at is null or l.ends_at > now())
  order by l.severity = 'severe' desc, l.starts_at
  limit 20;
$$;

revoke execute on function public.local_alerts_for_area(uuid, integer) from public;
grant execute on function public.local_alerts_for_area(uuid, integer) to anon, authenticated, service_role;
