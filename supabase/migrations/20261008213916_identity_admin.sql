-- M1: role management and account deletion, server-only (SPEC §3.1, §17.5).

-- Grants or changes a staff role. Called from an audited admin action, or by hand for the first admin:
--   select public.auth_set_role('<user id>', 'admin', null);
create function public.auth_set_role(p_user_id uuid, p_role text, p_granted_by uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_role not in ('ops', 'admin') then
    raise exception 'role must be ops or admin' using errcode = '22023';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (p_user_id, p_role, p_granted_by)
  on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();

  insert into internal.audit_log (actor_id, action, entity, entity_id, diff)
  values (p_granted_by, 'role_granted', 'user', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

revoke execute on function public.auth_set_role(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.auth_set_role(uuid, text, uuid) to service_role;


-- Removes a staff role and ends that person's two-factor sessions, so access stops at once.
create function public.auth_remove_role(p_user_id uuid, p_removed_by uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.user_roles where user_id = p_user_id;
  update internal.sessions set revoked_at = now() where user_id = p_user_id and revoked_at is null and aal = 'aal2';

  insert into internal.audit_log (actor_id, action, entity, entity_id)
  values (p_removed_by, 'role_removed', 'user', p_user_id::text);
end;
$$;

revoke execute on function public.auth_remove_role(uuid, uuid) from public, anon, authenticated;
grant execute on function public.auth_remove_role(uuid, uuid) to service_role;


-- Deletes the account row and everything that cascades from it. The account_deletion job (M12)
-- also removes storage objects through the Storage API first (SPEC §17.5). The audit entry keeps
-- only the id.
create function public.auth_delete_user(p_user_id uuid, p_deleted_by uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from internal.users where id = p_user_id;
  if not found then
    return false;
  end if;

  insert into internal.audit_log (actor_id, action, entity, entity_id)
  values (p_deleted_by, 'user_deleted', 'user', p_user_id::text);
  return true;
end;
$$;

revoke execute on function public.auth_delete_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.auth_delete_user(uuid, uuid) to service_role;


-- Looks up a user id by email, for the admin "grant role" tool and tests.
create function public.auth_find_user(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from internal.users where email = lower(btrim(p_email))::extensions.citext;
$$;

revoke execute on function public.auth_find_user(text) from public, anon, authenticated;
grant execute on function public.auth_find_user(text) to service_role;
