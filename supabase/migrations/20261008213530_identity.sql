-- M1: identity (SPEC §3, §4.6, §12.2, §12.3) with Oya-managed email + password sign-in.
--
-- Supabase Auth is not used (docs/decisions.md D-006, D-010). Credentials, sessions, MFA secrets,
-- rate limits and the audit log live in the private `internal` schema: RLS on, no policies, nothing
-- granted to anon or authenticated, and the schema isn't exposed through the Data API. Server code
-- reaches them only through the security-definer `auth_*` functions below, executable by service_role.
--
-- The server signs Supabase-compatible access tokens (sub = users.id, role = authenticated, app_role,
-- aal), so auth.uid() and auth.jwt() work in RLS exactly as the spec describes.

create extension if not exists citext with schema extensions;

create schema if not exists internal;
revoke all on schema internal from public, anon, authenticated;
grant usage on schema internal to service_role;


-- ---------------------------------------------------------------------------
-- Internal: credentials, sessions, MFA, rate limits, audit log
-- ---------------------------------------------------------------------------

create table internal.users (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- scrypt$N$r$p$salt$hash (src/server/auth/password.ts). Never leaves the server.
  password_hash text not null,
  password_updated_at timestamptz not null default now(),
  failed_sign_ins integer not null default 0,
  locked_until timestamptz,
  last_sign_in_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at before update on internal.users
for each row execute function public.set_updated_at();

alter table internal.users enable row level security;
revoke all on table internal.users from public, anon, authenticated;
grant select, insert, update, delete on table internal.users to service_role;


create table internal.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  -- SHA-256 of the 32-byte random cookie token. The token itself is never stored.
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  aal text not null default 'aal1' check (aal in ('aal1', 'aal2')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_hash text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 400)
);

create index sessions_user_id_idx on internal.sessions (user_id) where revoked_at is null;

alter table internal.sessions enable row level security;
revoke all on table internal.sessions from public, anon, authenticated;
grant select, insert, update, delete on table internal.sessions to service_role;


create table internal.mfa_factors (
  user_id uuid primary key references internal.users (id) on delete cascade,
  -- TOTP secret, AES-256-GCM encrypted with APP_ENCRYPTION_KEY (src/server/crypto.ts).
  secret_ciphertext text not null,
  verified_at timestamptz,
  -- Highest TOTP time step accepted so far, so a code can't be replayed.
  last_used_step bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mfa_factors_set_updated_at before update on internal.mfa_factors
for each row execute function public.set_updated_at();

alter table internal.mfa_factors enable row level security;
revoke all on table internal.mfa_factors from public, anon, authenticated;
grant select, insert, update, delete on table internal.mfa_factors to service_role;


create table internal.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

alter table internal.rate_limits enable row level security;
revoke all on table internal.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table internal.rate_limits to service_role;


create table internal.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (char_length(action) <= 80),
  entity text not null check (char_length(entity) <= 80),
  entity_id text,
  diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on internal.audit_log (entity, entity_id, created_at desc);
create index audit_log_actor_idx on internal.audit_log (actor_id, created_at desc);

alter table internal.audit_log enable row level security;
revoke all on table internal.audit_log from public, anon, authenticated;
-- Append-only, even for the server.
grant select, insert on table internal.audit_log to service_role;


-- ---------------------------------------------------------------------------
-- Public: profiles, roles, consents, channel identities
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references internal.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  phone_e164 text unique check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email extensions.citext,
  language text not null default 'en' check (language in ('en', 'pcm', 'ibb', 'yo', 'ig', 'ha')),
  timezone text not null default 'Africa/Lagos' check (char_length(timezone) <= 64),
  -- Side effects (bookings, messages to third parties) require it (SPEC §3.3).
  age_confirmed_at timestamptz,
  -- FK to public.areas is added in M2, when areas exists.
  power_area_id uuid,
  reporter_trust numeric(3, 2) not null default 0.5 check (reporter_trust between 0 and 2),
  -- zod-validated in src/server/profile/prefs.ts
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object'),
  -- Bootstrap mode: phone confirmed by an ops call-back before any booking (SPEC §20.1).
  phone_verified_by_ops_at timestamptz,
  -- Kept for the phone OTP path behind the phone_otp flag (SPEC §4.6).
  last_otp_verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per Oya user. Writes go through server actions (R13).';

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

create policy "users read their own profile" on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy "ops read profiles" on public.profiles
for select to authenticated
using ((select auth.jwt() ->> 'app_role') in ('ops', 'admin') and (select auth.jwt() ->> 'aal') = 'aal2');


create table public.user_roles (
  user_id uuid primary key references internal.users (id) on delete cascade,
  role text not null check (role in ('ops', 'admin')),
  granted_by uuid references internal.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
revoke all on table public.user_roles from anon, authenticated;
grant select on table public.user_roles to authenticated;
grant select, insert, update, delete on table public.user_roles to service_role;

create policy "users read their own role" on public.user_roles
for select to authenticated
using (user_id = (select auth.uid()));

create policy "admins read roles" on public.user_roles
for select to authenticated
using ((select auth.jwt() ->> 'app_role') = 'admin' and (select auth.jwt() ->> 'aal') = 'aal2');


create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  purpose text not null check (purpose in (
    'terms', 'privacy', 'location', 'whatsapp_updates', 'sms_updates', 'voice_processing',
    'share_contact_on_booking', 'health_info', 'cross_border_processing', 'research_insights'
  )),
  granted boolean not null,
  policy_version text not null check (char_length(policy_version) <= 40),
  channel text not null default 'web' check (channel in ('web', 'whatsapp', 'telegram', 'sms', 'ops')),
  created_at timestamptz not null default now()
);

comment on table public.consents is 'Append-only consent history. The latest row per purpose wins.';

create index consents_user_purpose_idx on public.consents (user_id, purpose, created_at desc);

alter table public.consents enable row level security;
revoke all on table public.consents from anon, authenticated;
grant select on table public.consents to authenticated;
-- Append-only (SPEC §12.3): the server can insert and read, never update or delete.
grant select, insert on table public.consents to service_role;

create policy "users read their own consents" on public.consents
for select to authenticated
using (user_id = (select auth.uid()));

create policy "ops read consents" on public.consents
for select to authenticated
using ((select auth.jwt() ->> 'app_role') in ('ops', 'admin') and (select auth.jwt() ->> 'aal') = 'aal2');


create table public.channel_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references internal.users (id) on delete cascade,
  channel text not null check (channel in ('web', 'whatsapp', 'telegram', 'sms')),
  external_id text not null check (char_length(external_id) <= 200),
  verified_at timestamptz,
  opt_in_at timestamptz,
  opt_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_id)
);

create index channel_identities_user_idx on public.channel_identities (user_id);

create trigger channel_identities_set_updated_at before update on public.channel_identities
for each row execute function public.set_updated_at();

alter table public.channel_identities enable row level security;
revoke all on table public.channel_identities from anon, authenticated;
grant select on table public.channel_identities to authenticated;
grant select, insert, update, delete on table public.channel_identities to service_role;

create policy "users read their own channel identities" on public.channel_identities
for select to authenticated
using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- Server-only functions (service_role). Each is security definer with an empty search_path.
-- ---------------------------------------------------------------------------

-- Fixed-window rate limit. Returns true if this hit is within the limit.
create function public.hit_rate_limit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into internal.rate_limits (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = internal.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;


create function public.write_audit(p_actor_id uuid, p_action text, p_entity text, p_entity_id text, p_diff jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into internal.audit_log (actor_id, action, entity, entity_id, diff)
  values (p_actor_id, p_action, p_entity, p_entity_id, coalesce(p_diff, '{}'::jsonb));
$$;

revoke execute on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit(uuid, text, text, text, jsonb) to service_role;


-- Creates the user, their profile and their sign-up consents in one transaction.
-- Raises unique_violation (23505) if the email is taken.
create function public.auth_create_user(
  p_email text,
  p_password_hash text,
  p_display_name text,
  p_language text,
  p_policy_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into internal.users (email, password_hash)
  values (lower(btrim(p_email)), p_password_hash)
  returning id into v_id;

  insert into public.profiles (id, display_name, email, language, age_confirmed_at)
  values (v_id, btrim(p_display_name), lower(btrim(p_email)), p_language, now());

  insert into public.consents (user_id, purpose, granted, policy_version, channel)
  values (v_id, 'terms', true, p_policy_version, 'web'),
         (v_id, 'privacy', true, p_policy_version, 'web');

  insert into public.channel_identities (user_id, channel, external_id, verified_at)
  values (v_id, 'web', v_id::text, now());

  insert into internal.audit_log (actor_id, action, entity, entity_id)
  values (v_id, 'sign_up', 'user', v_id::text);

  return v_id;
end;
$$;

revoke execute on function public.auth_create_user(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.auth_create_user(text, text, text, text, text) to service_role;


create function public.auth_get_credentials(p_email text)
returns table (user_id uuid, password_hash text, locked_until timestamptz, disabled_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select id, password_hash, locked_until, disabled_at
  from internal.users
  where email = lower(btrim(p_email))::extensions.citext;
$$;

revoke execute on function public.auth_get_credentials(text) from public, anon, authenticated;
grant execute on function public.auth_get_credentials(text) to service_role;


create function public.auth_get_password_hash(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select password_hash from internal.users where id = p_user_id and disabled_at is null;
$$;

revoke execute on function public.auth_get_password_hash(uuid) from public, anon, authenticated;
grant execute on function public.auth_get_password_hash(uuid) to service_role;


-- Counts a wrong password. Locks the account for p_lock_seconds after p_max consecutive failures.
-- Returns the lock expiry, or null if not locked.
create function public.auth_record_failed_sign_in(p_user_id uuid, p_max integer, p_lock_seconds integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked timestamptz;
begin
  update internal.users
  set failed_sign_ins = failed_sign_ins + 1,
      locked_until = case when failed_sign_ins + 1 >= p_max then now() + make_interval(secs => p_lock_seconds) else locked_until end
  where id = p_user_id
  returning case when locked_until > now() then locked_until end into v_locked;

  insert into internal.audit_log (actor_id, action, entity, entity_id, diff)
  values (p_user_id, 'sign_in_failed', 'user', p_user_id::text, jsonb_build_object('locked', v_locked is not null));

  return v_locked;
end;
$$;

revoke execute on function public.auth_record_failed_sign_in(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.auth_record_failed_sign_in(uuid, integer, integer) to service_role;


-- Successful sign-in: resets the failure count and opens a session.
create function public.auth_create_session(
  p_user_id uuid,
  p_token_hash bytea,
  p_expires_at timestamptz,
  p_ip_hash text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session uuid;
begin
  update internal.users
  set failed_sign_ins = 0, locked_until = null, last_sign_in_at = now()
  where id = p_user_id and disabled_at is null;
  if not found then
    raise exception 'user not found or disabled' using errcode = 'P0002';
  end if;

  insert into internal.sessions (user_id, token_hash, expires_at, ip_hash, user_agent)
  values (p_user_id, p_token_hash, p_expires_at, p_ip_hash, left(p_user_agent, 400))
  returning id into v_session;

  insert into internal.audit_log (actor_id, action, entity, entity_id)
  values (p_user_id, 'sign_in', 'session', v_session::text);

  return v_session;
end;
$$;

revoke execute on function public.auth_create_session(uuid, bytea, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.auth_create_session(uuid, bytea, timestamptz, text, text) to service_role;


-- Resolves a session cookie. Returns nothing if the session is unknown, revoked, expired or the user
-- is disabled. Slides last_seen_at at most every 5 minutes, and extends expiry to p_extend_to when
-- the session is still in use.
create function public.auth_get_session(p_token_hash bytea, p_extend_to timestamptz)
returns table (
  session_id uuid,
  user_id uuid,
  email text,
  aal text,
  app_role text,
  display_name text,
  language text,
  timezone text,
  expires_at timestamptz,
  mfa_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update internal.sessions s
  set last_seen_at = now(),
      expires_at = greatest(s.expires_at, p_extend_to)
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and s.last_seen_at < now() - interval '5 minutes';

  return query
  select s.id, u.id, u.email::text, s.aal, r.role, p.display_name, p.language, p.timezone, s.expires_at,
         (m.verified_at is not null)
  from internal.sessions s
  join internal.users u on u.id = s.user_id and u.disabled_at is null
  join public.profiles p on p.id = u.id and p.deleted_at is null
  left join public.user_roles r on r.user_id = u.id
  left join internal.mfa_factors m on m.user_id = u.id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now();
end;
$$;

revoke execute on function public.auth_get_session(bytea, timestamptz) from public, anon, authenticated;
grant execute on function public.auth_get_session(bytea, timestamptz) to service_role;


create function public.auth_revoke_session(p_token_hash bytea)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_session uuid;
begin
  update internal.sessions set revoked_at = now()
  where token_hash = p_token_hash and revoked_at is null
  returning user_id, id into v_user, v_session;

  if v_session is not null then
    insert into internal.audit_log (actor_id, action, entity, entity_id)
    values (v_user, 'sign_out', 'session', v_session::text);
  end if;
end;
$$;

revoke execute on function public.auth_revoke_session(bytea) from public, anon, authenticated;
grant execute on function public.auth_revoke_session(bytea) to service_role;


-- Signs out every other session (after a password change, or "sign out everywhere else").
create function public.auth_revoke_other_sessions(p_user_id uuid, p_keep_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update internal.sessions set revoked_at = now()
  where user_id = p_user_id and revoked_at is null and id is distinct from p_keep_session_id;
  get diagnostics v_count = row_count;

  insert into internal.audit_log (actor_id, action, entity, entity_id, diff)
  values (p_user_id, 'revoke_other_sessions', 'user', p_user_id::text, jsonb_build_object('count', v_count));
  return v_count;
end;
$$;

revoke execute on function public.auth_revoke_other_sessions(uuid, uuid) from public, anon, authenticated;
grant execute on function public.auth_revoke_other_sessions(uuid, uuid) to service_role;


create function public.auth_list_sessions(p_user_id uuid)
returns table (session_id uuid, created_at timestamptz, last_seen_at timestamptz, user_agent text, aal text)
language sql
stable
security definer
set search_path = ''
as $$
  select id, created_at, last_seen_at, user_agent, aal
  from internal.sessions
  where user_id = p_user_id and revoked_at is null and expires_at > now()
  order by last_seen_at desc;
$$;

revoke execute on function public.auth_list_sessions(uuid) from public, anon, authenticated;
grant execute on function public.auth_list_sessions(uuid) to service_role;


create function public.auth_set_password(p_user_id uuid, p_password_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update internal.users
  set password_hash = p_password_hash, password_updated_at = now(), failed_sign_ins = 0, locked_until = null
  where id = p_user_id;

  insert into internal.audit_log (actor_id, action, entity, entity_id)
  values (p_user_id, 'password_changed', 'user', p_user_id::text);
end;
$$;

revoke execute on function public.auth_set_password(uuid, text) from public, anon, authenticated;
grant execute on function public.auth_set_password(uuid, text) to service_role;


-- TOTP (ops/admin MFA, SPEC §4.6).
create function public.auth_mfa_get(p_user_id uuid)
returns table (secret_ciphertext text, verified_at timestamptz, last_used_step bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select secret_ciphertext, verified_at, last_used_step from internal.mfa_factors where user_id = p_user_id;
$$;

revoke execute on function public.auth_mfa_get(uuid) from public, anon, authenticated;
grant execute on function public.auth_mfa_get(uuid) to service_role;


-- Starts (or restarts) enrolment. Refuses to replace a verified factor.
create function public.auth_mfa_begin(p_user_id uuid, p_secret_ciphertext text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into internal.mfa_factors (user_id, secret_ciphertext)
  values (p_user_id, p_secret_ciphertext)
  on conflict (user_id) do update
    set secret_ciphertext = excluded.secret_ciphertext, last_used_step = 0
    where internal.mfa_factors.verified_at is null;
  return found;
end;
$$;

revoke execute on function public.auth_mfa_begin(uuid, text) from public, anon, authenticated;
grant execute on function public.auth_mfa_begin(uuid, text) to service_role;


-- Records a correct TOTP code for time step p_step. Fails if that step (or a later one) was already
-- used, which blocks replays. Marks the factor verified and raises the session to aal2.
create function public.auth_mfa_accept(p_user_id uuid, p_session_id uuid, p_step bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first boolean;
begin
  update internal.mfa_factors
  set last_used_step = p_step, verified_at = coalesce(verified_at, now())
  where user_id = p_user_id and last_used_step < p_step
  returning (verified_at = now()) into v_first;
  if not found then
    return false;
  end if;

  update internal.sessions set aal = 'aal2' where id = p_session_id and user_id = p_user_id and revoked_at is null;

  insert into internal.audit_log (actor_id, action, entity, entity_id)
  values (p_user_id, case when v_first then 'mfa_enrolled' else 'mfa_verified' end, 'session', p_session_id::text);
  return true;
end;
$$;

revoke execute on function public.auth_mfa_accept(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.auth_mfa_accept(uuid, uuid, bigint) to service_role;
