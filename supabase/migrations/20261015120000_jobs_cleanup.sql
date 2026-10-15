-- M2: deletes finished jobs (and their webhook events) by id. Used by the retention purge for old jobs and
-- by integration tests, which must leave nothing behind in the shared project (docs/decisions.md D-005).
-- Running jobs are never deleted.

create function public.delete_jobs(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from internal.webhook_events e where e.job_id = any (p_ids);
  delete from internal.jobs j where j.id = any (p_ids) and j.status <> 'running';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.delete_jobs(uuid[]) from public, anon, authenticated;
grant execute on function public.delete_jobs(uuid[]) to service_role;


-- Job ids for a set of tasks' timers, so tests (and ops tools) can find what a task scheduled.
create function public.task_timer_jobs(p_task_ids uuid[])
returns table (id uuid, status text, timer text, run_at timestamptz, attempts integer, locked_by text, dedupe_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.status, j.payload ->> 'timer', j.run_at, j.attempts, j.locked_by, j.dedupe_key
  from internal.jobs j
  where j.type = 'task_timer' and (j.payload ->> 'task_id')::uuid = any (p_task_ids)
  order by j.created_at;
$$;

revoke execute on function public.task_timer_jobs(uuid[]) from public, anon, authenticated;
grant execute on function public.task_timer_jobs(uuid[]) to service_role;
