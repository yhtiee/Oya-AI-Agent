-- transition_task: report a version mismatch as PT409 (HTTP 409) instead of 40001. PostgREST retries
-- serialization failures itself, so 40001 never reached the caller (docs/decisions.md D-015).

create or replace function public.transition_task(
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
      using errcode = 'PT409';
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
