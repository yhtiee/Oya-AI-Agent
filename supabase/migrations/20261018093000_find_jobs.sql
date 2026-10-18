-- M4: look up jobs by dedupe key pattern, for the ops console and for integration tests that must find (and
-- delete) the jobs their test data produced. Service role only.

create function public.find_jobs(p_dedupe_like text, p_limit integer default 100)
returns table (id uuid, type text, status text, run_at timestamptz, attempts integer, dedupe_key text, payload jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, j.type, j.status, j.run_at, j.attempts, j.dedupe_key, j.payload
  from internal.jobs j
  where j.dedupe_key like p_dedupe_like
  order by j.created_at
  limit greatest(1, least(p_limit, 500));
$$;

revoke execute on function public.find_jobs(text, integer) from public, anon, authenticated;
grant execute on function public.find_jobs(text, integer) to service_role;
