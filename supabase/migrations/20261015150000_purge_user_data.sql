-- M3: removes rows that reference users without a foreign-key cascade: LLM call logs, analytics, rate-limit
-- counters, safety events, demand signals and ops items tied to their conversations. Used by account deletion
-- (SPEC §17.5) before auth_delete_user, and by integration tests so nothing is left in the shared project.

create function public.purge_user_data(p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  v_rows integer;
  v_conversations uuid[];
begin
  select coalesce(array_agg(c.id), '{}') into v_conversations from public.conversations c where c.user_id = any (p_user_ids);

  delete from public.ops_queue q
  where (q.meta ->> 'conversation_id') is not null and (q.meta ->> 'conversation_id')::uuid = any (v_conversations);
  get diagnostics v_rows = row_count; v_n := v_n + v_rows;

  delete from public.safety_events e where e.user_id = any (p_user_ids);
  get diagnostics v_rows = row_count; v_n := v_n + v_rows;

  delete from public.demand_signals d where d.user_id = any (p_user_ids);
  get diagnostics v_rows = row_count; v_n := v_n + v_rows;

  delete from internal.llm_calls c where c.user_id = any (p_user_ids);
  get diagnostics v_rows = row_count; v_n := v_n + v_rows;

  delete from internal.analytics_events a where a.user_id = any (p_user_ids);
  get diagnostics v_rows = row_count; v_n := v_n + v_rows;

  delete from internal.rate_limits r
  where r.key like any (select '%' || u::text || '%' from unnest(p_user_ids) u);
  get diagnostics v_rows = row_count; v_n := v_n + v_rows;

  return v_n;
end;
$$;

revoke execute on function public.purge_user_data(uuid[]) from public, anon, authenticated;
grant execute on function public.purge_user_data(uuid[]) to service_role;
