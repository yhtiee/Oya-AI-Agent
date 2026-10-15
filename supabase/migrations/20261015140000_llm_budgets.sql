-- M3: LLM spend for budget checks (SPEC §7.10, §20.1). Days are Africa/Lagos calendar days.

-- log_llm_call also adds the cost to the task, so the per-task cap reads one row.
create or replace function public.log_llm_call(p_call jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_cost bigint := coalesce((p_call ->> 'cost_micros')::bigint, 0);
  v_task uuid := (p_call ->> 'task_id')::uuid;
begin
  insert into internal.llm_calls (
    provider, model, purpose, status, fallback_from, input_tokens, cache_read_tokens, cache_write_tokens,
    output_tokens, web_search_requests, cost_micros, latency_ms, task_id, user_id
  )
  values (
    p_call ->> 'provider', p_call ->> 'model', p_call ->> 'purpose', p_call ->> 'status', p_call ->> 'fallback_from',
    coalesce((p_call ->> 'input_tokens')::integer, 0), coalesce((p_call ->> 'cache_read_tokens')::integer, 0),
    coalesce((p_call ->> 'cache_write_tokens')::integer, 0), coalesce((p_call ->> 'output_tokens')::integer, 0),
    coalesce((p_call ->> 'web_search_requests')::integer, 0), v_cost,
    (p_call ->> 'latency_ms')::integer, v_task, (p_call ->> 'user_id')::uuid
  )
  returning id into v_id;

  if v_task is not null and v_cost > 0 then
    update public.tasks set cost_micros = cost_micros + v_cost where id = v_task;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.log_llm_call(jsonb) from public, anon, authenticated;
grant execute on function public.log_llm_call(jsonb) to service_role;


-- Today's spend for the whole app and for one user, plus one task's total, in micro-dollars.
create function public.llm_spend(p_user_id uuid default null, p_task_id uuid default null)
returns table (app_today_micros bigint, user_today_micros bigint, task_micros bigint, user_calls_today bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with today as (
    select (date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos') as start
  )
  select
    coalesce((select sum(c.cost_micros) from internal.llm_calls c, today where c.created_at >= today.start), 0)::bigint,
    coalesce((select sum(c.cost_micros) from internal.llm_calls c, today
              where p_user_id is not null and c.user_id = p_user_id and c.created_at >= today.start), 0)::bigint,
    coalesce((select t.cost_micros from public.tasks t where t.id = p_task_id), 0)::bigint,
    coalesce((select count(*) from internal.llm_calls c, today
              where p_user_id is not null and c.user_id = p_user_id and c.created_at >= today.start), 0)::bigint;
$$;

revoke execute on function public.llm_spend(uuid, uuid) from public, anon, authenticated;
grant execute on function public.llm_spend(uuid, uuid) to service_role;
