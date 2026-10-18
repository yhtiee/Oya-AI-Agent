-- M4: in-app notifications, due reminders, watch firing on confirmed power changes, the alerts digest job
-- (SPEC §5.1, §5.6, §5.7, §9). Additive only.

-- In-app inbox (the bell): users read their own notifications; marking read goes through a server action.
alter table public.notifications add column read_at timestamptz;

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc)
  where user_id is not null and read_at is null;

create policy "users read their own notifications" on public.notifications
for select to authenticated
using (user_id = (select auth.uid()));


-- The morning local-alerts digest is a daily job (SPEC §5.6).
alter table internal.jobs drop constraint jobs_type_check;
alter table internal.jobs add constraint jobs_type_check check (type in (
  'process_inbound', 'resume_turn', 'task_timer', 'send_outbound', 'reminder_fire', 'watch_eval',
  'power_status_recompute', 'provider_daily_menu', 'kb_freshness_check', 'cost_report', 'retention_purge',
  'account_deletion', 'reconcile_payments', 'llm_breaker_check', 'deferred_message', 'backup_dump', 'alerts_digest'
));


-- Queues a reminder_fire job for every scheduled reminder due within the horizon, once per occurrence
-- (dedupe on reminder id + remind_at, so a rescheduled or recurring reminder gets a fresh job). Called every tick.
create function public.enqueue_due_reminders(p_horizon_s integer default 90)
returns integer
language sql
security definer
set search_path = ''
as $$
  with due as (
    insert into internal.jobs (type, payload, run_at, dedupe_key)
    select 'reminder_fire',
           jsonb_build_object('reminder_id', r.id, 'remind_at', r.remind_at),
           r.remind_at,
           'reminder:' || r.id || ':' || extract(epoch from r.remind_at)::bigint
    from public.reminders r
    where r.status = 'scheduled' and r.remind_at <= now() + make_interval(secs => p_horizon_s)
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*)::integer from due;
$$;

revoke execute on function public.enqueue_due_reminders(integer) from public, anon, authenticated;
grant execute on function public.enqueue_due_reminders(integer) to service_role;


-- Every confirmed power change (the only thing that fires watches, SPEC §5.1 step 4) queues one watch_eval job,
-- whichever path confirmed it (a report, an ops entry or the 10-minute recompute).
create function internal.enqueue_watch_eval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into internal.jobs (type, payload, dedupe_key)
  values ('watch_eval',
          jsonb_build_object('change_id', new.id, 'area_id', new.area_id, 'to_status', new.to_status),
          'watch_eval:' || new.id)
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke execute on function internal.enqueue_watch_eval() from public, anon, authenticated;

create trigger power_status_changes_enqueue_watch_eval after insert on public.power_status_changes
for each row execute function internal.enqueue_watch_eval();


-- Active watches that a change to `p_to_status` in `p_area_id` should fire, with what's needed to notify.
create function public.watches_for_power_change(p_area_id uuid, p_to_status text)
returns table (watch_id uuid, user_id uuid, language text, timezone text, overnight boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.user_id, p.language, p.timezone,
         coalesce((p.prefs -> 'power' ->> 'overnight_alerts')::boolean, false)
  from public.watches w
  join public.profiles p on p.id = w.user_id
  where w.active and w.area_id = p_area_id
    and w.type = case p_to_status when 'on' then 'power_on' when 'off' then 'power_off' end
    and p.deleted_at is null;
$$;

revoke execute on function public.watches_for_power_change(uuid, text) from public, anon, authenticated;
grant execute on function public.watches_for_power_change(uuid, text) to service_role;
