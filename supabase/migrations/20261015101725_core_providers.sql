-- M2 (2/6): providers, members, services, requests, check-ins (SPEC §12.2, §12.3, §13).
-- Tasks don't exist yet in this migration; FKs from provider_requests/check-ins to tasks are added in 3/6.

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('individual', 'business', 'clinic', 'hospital', 'lab', 'pharmacy', 'office', 'school', 'other')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  categories text[] not null default '{}',
  trades text[] not null default '{}',
  description text check (description is null or char_length(description) <= 1000),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp_opt_in_at timestamptz,
  whatsapp_opt_in_evidence jsonb,
  location extensions.geography(Point, 4326),
  address_text text check (address_text is null or char_length(address_text) <= 300),
  landmark text check (landmark is null or char_length(landmark) <= 200),
  area_id uuid references public.areas (id) on delete set null,
  service_radius_m integer not null default 3000 check (service_radius_m between 100 and 100000),
  does_home_visits boolean not null default false,
  hours jsonb not null default '{}'::jsonb check (jsonb_typeof(hours) = 'object'),
  open_24h boolean not null default false,
  emergency_capable boolean not null default false,
  phone_verified_by_ops_at timestamptz,
  accepting_requests boolean not null default true,
  -- Ordered: unverified < phone < in_person < id < premises < licensed (SPEC §13.2).
  verification_level text not null default 'unverified'
    check (verification_level in ('unverified', 'phone', 'in_person', 'id', 'premises', 'licensed')),
  id_check_ref text,
  id_checked_at timestamptz,
  verified_name text check (verified_name is null or char_length(verified_name) <= 160),
  licence_ref text,
  licence_body text check (licence_body is null or licence_body in ('PCN', 'STATE_MOH', 'OTHER')),
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'suspended', 'removed')),
  source text not null default 'oya' check (source in ('oya', 'partner:handlancer')),
  payout_bank_code text,
  payout_account_number text,
  payout_account_name_verified text,
  payout_verified_at timestamptz,
  paystack_subaccount_code text,
  rating_avg numeric(3, 2) check (rating_avg is null or rating_avg between 1 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  response_rate numeric(4, 3) check (response_rate is null or response_rate between 0 and 1),
  median_response_sec integer check (median_response_sec is null or median_response_sec >= 0),
  completion_rate numeric(4, 3) check (completion_rate is null or completion_rate between 0 and 1),
  no_show_count_30d integer not null default 0 check (no_show_count_30d >= 0),
  last_active_at timestamptz,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.providers is 'People and places who help. Public columns only via column grants; members use provider_get_profile().';

create index providers_location_idx on public.providers using gist (location);
create index providers_categories_idx on public.providers using gin (categories);
create index providers_trades_idx on public.providers using gin (trades);
create index providers_area_status_idx on public.providers (area_id, status);
create unique index providers_phone_key on public.providers (phone_e164) where phone_e164 is not null and status <> 'removed';

create trigger providers_set_updated_at before update on public.providers
for each row execute function public.set_updated_at();

alter table public.providers enable row level security;
revoke all on table public.providers from anon, authenticated;
-- Column-level grants: no phone, exact location, address or bank columns (SPEC §12.3). select('*') fails by design.
grant select (id, type, display_name, categories, trades, description, area_id, service_radius_m, does_home_visits,
              hours, open_24h, emergency_capable, accepting_requests, verification_level, status, rating_avg,
              rating_count, response_rate, photo_path, last_active_at)
  on table public.providers to anon, authenticated;
grant select, insert, update, delete on table public.providers to service_role;

create policy "anyone reads active providers" on public.providers
for select to anon, authenticated
using (status = 'active' or (select public.is_staff()));

create view public.providers_public with (security_invoker = true) as
select id, type, display_name, categories, trades, description, area_id, service_radius_m, does_home_visits,
       hours, open_24h, emergency_capable, accepting_requests, verification_level, rating_avg, rating_count,
       response_rate, photo_path, last_active_at
from public.providers
where status = 'active';

revoke all on public.providers_public from public, anon, authenticated;
grant select on public.providers_public to anon, authenticated, service_role;


create table public.provider_members (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  user_id uuid not null references internal.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  unique (provider_id, user_id)
);

create index provider_members_user_idx on public.provider_members (user_id);

alter table public.provider_members enable row level security;
revoke all on table public.provider_members from anon, authenticated;
grant select on table public.provider_members to authenticated;
grant select, insert, update, delete on table public.provider_members to service_role;

create policy "members read their own memberships" on public.provider_members
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff()));


-- True if the caller is a member of the provider. Used by the provider_* access functions.
create function public.is_provider_member(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.provider_members where provider_id = p_provider_id and user_id = auth.uid());
$$;

revoke execute on function public.is_provider_member(uuid) from public, anon;
grant execute on function public.is_provider_member(uuid) to authenticated, service_role;


create table public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  category text not null check (char_length(category) <= 60),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  price_min_kobo bigint check (price_min_kobo is null or price_min_kobo >= 0),
  price_max_kobo bigint check (price_max_kobo is null or price_max_kobo >= 0),
  unit text check (unit is null or char_length(unit) <= 40),
  is_call_out_fee boolean not null default false,
  available_today boolean not null default false,
  available_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_range_ordered check (price_min_kobo is null or price_max_kobo is null or price_min_kobo <= price_max_kobo)
);

create index provider_services_available_idx on public.provider_services (provider_id, available_today);
create index provider_services_name_trgm_idx on public.provider_services using gin (name extensions.gin_trgm_ops);

create trigger provider_services_set_updated_at before update on public.provider_services
for each row execute function public.set_updated_at();

alter table public.provider_services enable row level security;
revoke all on table public.provider_services from anon, authenticated;
grant select on table public.provider_services to anon, authenticated;
grant select, insert, update, delete on table public.provider_services to service_role;

create policy "anyone reads services of active providers" on public.provider_services
for select to anon, authenticated
using (
  exists (select 1 from public.providers p where p.id = provider_id and p.status = 'active')
  or (select public.is_staff())
);


-- No direct access for providers; they go through provider_get_request() / provider_respond() (SPEC §12.3).
create table public.provider_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  provider_id uuid not null references public.providers (id) on delete cascade,
  wave integer not null default 1 check (wave between 1 and 5),
  kind text not null check (kind in ('quote', 'booking')),
  channel text not null check (channel in ('whatsapp', 'sms', 'portal', 'ops')),
  -- Redacted brief shown to the provider: category, summary, area, time window, budget if shared.
  brief jsonb not null default '{}'::jsonb check (jsonb_typeof(brief) = 'object'),
  sent_at timestamptz,
  responded_at timestamptz,
  response text not null default 'pending'
    check (response in ('pending', 'accepted', 'quoted', 'declined', 'no_response', 'question', 'closed', 'expired')),
  quote_kobo bigint check (quote_kobo is null or quote_kobo >= 0),
  eta_minutes integer check (eta_minutes is null or eta_minutes between 0 and 10080),
  note text check (note is null or char_length(note) <= 500),
  token_hash bytea unique check (token_hash is null or octet_length(token_hash) = 32),
  token_expires_at timestamptz,
  link_bound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, provider_id, kind)
);

create index provider_requests_task_idx on public.provider_requests (task_id);
create index provider_requests_provider_response_idx on public.provider_requests (provider_id, response);

create trigger provider_requests_set_updated_at before update on public.provider_requests
for each row execute function public.set_updated_at();

alter table public.provider_requests enable row level security;
revoke all on table public.provider_requests from anon, authenticated;
grant select on table public.provider_requests to authenticated;
grant select, insert, update, delete on table public.provider_requests to service_role;

create policy "staff read provider requests" on public.provider_requests
for select to authenticated
using ((select public.is_staff()));


create table public.provider_check_ins (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  provider_id uuid not null references public.providers (id) on delete cascade,
  kind text not null check (kind in ('arrived', 'done', 'late')),
  at timestamptz not null default now(),
  source text not null check (source in ('whatsapp_button', 'portal', 'ops')),
  created_at timestamptz not null default now()
);

create index provider_check_ins_task_idx on public.provider_check_ins (task_id, at);

alter table public.provider_check_ins enable row level security;
revoke all on table public.provider_check_ins from anon, authenticated;
grant select on table public.provider_check_ins to authenticated;
grant select, insert, update, delete on table public.provider_check_ins to service_role;

create policy "staff read check-ins" on public.provider_check_ins
for select to authenticated
using ((select public.is_staff()));


-- Members read their own provider's full record (SPEC §12.3).
create function public.provider_get_profile(p_provider_id uuid)
returns setof public.providers
language sql
stable
security definer
set search_path = ''
as $$
  select p.* from public.providers p
  where p.id = p_provider_id
    and exists (select 1 from public.provider_members m where m.provider_id = p.id and m.user_id = auth.uid());
$$;

revoke execute on function public.provider_get_profile(uuid) from public, anon;
grant execute on function public.provider_get_profile(uuid) to authenticated, service_role;


-- Members update an allow-listed set of fields. Verification, status, ratings, bank checks and licence
-- fields can't be changed this way (SPEC §12.3).
create function public.provider_update_profile(p_provider_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed constant text[] := array[
    'display_name', 'description', 'categories', 'trades', 'hours', 'open_24h', 'service_radius_m',
    'does_home_visits', 'accepting_requests', 'landmark', 'address_text', 'photo_path'
  ];
  v_key text;
begin
  if not exists (select 1 from public.provider_members where provider_id = p_provider_id and user_id = auth.uid()) then
    raise exception 'not a member of this provider' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be an object' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not v_key = any (v_allowed) then
      raise exception 'field % cannot be updated here', v_key using errcode = '42501';
    end if;
  end loop;

  update public.providers p set
    display_name = coalesce(p_patch ->> 'display_name', p.display_name),
    description = case when p_patch ? 'description' then p_patch ->> 'description' else p.description end,
    categories = case when p_patch ? 'categories' then array(select jsonb_array_elements_text(p_patch -> 'categories')) else p.categories end,
    trades = case when p_patch ? 'trades' then array(select jsonb_array_elements_text(p_patch -> 'trades')) else p.trades end,
    hours = coalesce(p_patch -> 'hours', p.hours),
    open_24h = coalesce((p_patch ->> 'open_24h')::boolean, p.open_24h),
    service_radius_m = coalesce((p_patch ->> 'service_radius_m')::integer, p.service_radius_m),
    does_home_visits = coalesce((p_patch ->> 'does_home_visits')::boolean, p.does_home_visits),
    accepting_requests = coalesce((p_patch ->> 'accepting_requests')::boolean, p.accepting_requests),
    landmark = case when p_patch ? 'landmark' then p_patch ->> 'landmark' else p.landmark end,
    address_text = case when p_patch ? 'address_text' then p_patch ->> 'address_text' else p.address_text end,
    photo_path = case when p_patch ? 'photo_path' then p_patch ->> 'photo_path' else p.photo_path end,
    last_active_at = now()
  where p.id = p_provider_id;

  insert into internal.audit_log (actor_id, action, entity, entity_id, diff)
  values (auth.uid(), 'provider_profile_updated', 'provider', p_provider_id::text, p_patch - 'description');
end;
$$;

revoke execute on function public.provider_update_profile(uuid, jsonb) from public, anon;
grant execute on function public.provider_update_profile(uuid, jsonb) to authenticated, service_role;


-- Records a provider's response. Idempotent: a request that's no longer pending isn't changed, and the
-- current row is returned either way. Called by server actions only (SPEC §7.2b, §12.4).
create function public.provider_respond(
  p_request_id uuid,
  p_response text,
  p_quote_kobo bigint,
  p_eta_minutes integer,
  p_note text
)
returns setof public.provider_requests
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_response not in ('accepted', 'quoted', 'declined', 'question') then
    raise exception 'invalid response %', p_response using errcode = '22023';
  end if;

  update public.provider_requests
  set response = p_response,
      quote_kobo = coalesce(p_quote_kobo, quote_kobo),
      eta_minutes = coalesce(p_eta_minutes, eta_minutes),
      note = coalesce(left(p_note, 500), note),
      responded_at = now()
  where id = p_request_id and response in ('pending', 'question');

  update public.providers set last_active_at = now()
  where id = (select provider_id from public.provider_requests where id = p_request_id);

  return query select * from public.provider_requests where id = p_request_id;
end;
$$;

revoke execute on function public.provider_respond(uuid, text, bigint, integer, text) from public, anon, authenticated;
grant execute on function public.provider_respond(uuid, text, bigint, integer, text) to service_role;


-- Candidate search for a skill (SPEC §12.4, §15.2). Returns ids and public fields only.
create function public.nearby_providers(
  p_skill text,
  p_trade text,
  p_dish text,
  p_lng double precision,
  p_lat double precision,
  p_radius_m integer,
  p_limit integer default 20
)
returns table (
  provider_id uuid,
  display_name text,
  verification_level text,
  rating_avg numeric,
  rating_count integer,
  response_rate numeric,
  no_show_count_30d integer,
  last_active_at timestamptz,
  distance_m double precision,
  service_radius_m integer,
  matched_service_id uuid,
  matched_service_name text,
  price_min_kobo bigint,
  price_max_kobo bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select p.id, p.display_name, p.verification_level, p.rating_avg, p.rating_count, p.response_rate,
         p.no_show_count_30d, p.last_active_at,
         extensions.st_distance(p.location, o.g) as distance_m,
         p.service_radius_m,
         s.id, s.name, s.price_min_kobo, s.price_max_kobo
  from public.providers p
  cross join origin o
  left join lateral (
    select ps.* from public.provider_services ps
    where ps.provider_id = p.id
      and (p_skill <> 'food' or (ps.available_today and (ps.available_until is null or ps.available_until > now())))
      and (p_dish is null or ps.name ilike '%' || p_dish || '%' or extensions.similarity(ps.name, p_dish) > 0.3)
    order by ps.available_today desc, ps.price_min_kobo nulls last
    limit 1
  ) s on true
  where p.status = 'active'
    and p.accepting_requests
    and p.verification_level <> 'unverified'
    and p.location is not null
    and extensions.st_dwithin(p.location, o.g, least(p_radius_m, p.service_radius_m))
    and (p_trade is null or p_trade = any (p.trades) or p_trade = any (p.categories))
    and (p_skill <> 'food' or s.id is not null)
  order by extensions.st_distance(p.location, o.g)
  limit least(greatest(p_limit, 1), 50);
$$;

revoke execute on function public.nearby_providers(text, text, text, double precision, double precision, integer, integer) from public, anon, authenticated;
grant execute on function public.nearby_providers(text, text, text, double precision, double precision, integer, integer) to service_role;
