-- M2 (1/6): shared helpers, areas, places, saved places (SPEC §12.1, §12.2, §12.4).

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;


-- Staff check used by RLS policies: ops/admin role *and* a two-factor session (SPEC §4.6, §12.3).
create function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'app_role') in ('ops', 'admin') and (auth.jwt() ->> 'aal') = 'aal2', false);
$$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'app_role') = 'admin' and (auth.jwt() ->> 'aal') = 'aal2', false);
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;


-- Areas: country → state → LGA → neighbourhood/estate/campus, plus power clusters (one transformer).
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('country', 'state', 'lga', 'neighbourhood', 'estate', 'campus', 'power_cluster')),
  parent_id uuid references public.areas (id) on delete restrict,
  geom extensions.geography(MultiPolygon, 4326),
  centroid extensions.geography(Point, 4326),
  active boolean not null default true,
  -- Where the boundary came from (e.g. 'osm', 'ambassador_mapping_2026-11').
  source text not null default 'unknown' check (char_length(source) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index areas_geom_idx on public.areas using gist (geom);
create index areas_centroid_idx on public.areas using gist (centroid);
create index areas_parent_idx on public.areas (parent_id);
create unique index areas_name_kind_parent_key on public.areas (lower(name), kind, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

create trigger areas_set_updated_at before update on public.areas
for each row execute function public.set_updated_at();

alter table public.areas enable row level security;
revoke all on table public.areas from anon, authenticated;
grant select on table public.areas to anon, authenticated;
grant select, insert, update, delete on table public.areas to service_role;

-- Public read (SPEC §12.3). Writes happen through the import script and ops tools (service role).
create policy "anyone reads active areas" on public.areas
for select to anon, authenticated
using (active or (select public.is_staff()));

-- profiles.power_area_id was created in M1 before areas existed.
alter table public.profiles
  add constraint profiles_power_area_id_fkey foreign key (power_area_id) references public.areas (id) on delete set null;


-- The smallest active area containing a point (SPEC §12.4).
create function public.resolve_area(p_lng double precision, p_lat double precision)
returns table (id uuid, name text, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, a.kind
  from public.areas a
  where a.active
    and a.geom is not null
    and extensions.st_covers(a.geom, extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography)
  order by extensions.st_area(a.geom) asc
  limit 1;
$$;

revoke execute on function public.resolve_area(double precision, double precision) from public;
grant execute on function public.resolve_area(double precision, double precision) to anon, authenticated, service_role;


-- Imports or updates an area from GeoJSON (scripts/import-areas.ts). Polygons are promoted to MultiPolygon.
create function public.upsert_area(
  p_name text,
  p_kind text,
  p_parent_id uuid,
  p_geojson jsonb,
  p_source text,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_geom extensions.geography;
  v_id uuid;
begin
  if p_geojson is not null then
    v_geom := extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(p_geojson::text), 4326))::extensions.geography;
  end if;

  select id into v_id from public.areas
  where lower(name) = lower(btrim(p_name)) and kind = p_kind
    and coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_parent_id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_id is null then
    insert into public.areas (name, kind, parent_id, geom, centroid, source, active)
    values (btrim(p_name), p_kind, p_parent_id, v_geom,
            case when v_geom is null then null else extensions.st_centroid(v_geom::extensions.geometry)::extensions.geography end,
            p_source, p_active)
    returning id into v_id;
  else
    update public.areas
    set geom = coalesce(v_geom, geom),
        centroid = case when v_geom is null then centroid else extensions.st_centroid(v_geom::extensions.geometry)::extensions.geography end,
        source = p_source,
        active = p_active
    where id = v_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.upsert_area(text, text, uuid, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.upsert_area(text, text, uuid, jsonb, text, boolean) to service_role;


-- Google Places: only the place_id is kept, plus coordinates for at most 30 days (R9).
create table public.places (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'google' check (source in ('google')),
  google_place_id text not null unique check (char_length(google_place_id) <= 300),
  lat_lng extensions.geography(Point, 4326),
  lat_lng_cached_at timestamptz,
  created_at timestamptz not null default now(),
  constraint coordinates_need_a_timestamp check ((lat_lng is null) = (lat_lng_cached_at is null))
);

create index places_lat_lng_idx on public.places using gist (lat_lng);

alter table public.places enable row level security;
revoke all on table public.places from anon, authenticated;
grant select, insert, update, delete on table public.places to service_role;


create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references internal.users (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  location extensions.geography(Point, 4326) not null,
  address_text text check (address_text is null or char_length(address_text) <= 300),
  landmark text check (landmark is null or char_length(landmark) <= 200),
  area_id uuid references public.areas (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_places_user_idx on public.saved_places (user_id);
create index saved_places_location_idx on public.saved_places using gist (location);

create trigger saved_places_set_updated_at before update on public.saved_places
for each row execute function public.set_updated_at();

alter table public.saved_places enable row level security;
revoke all on table public.saved_places from anon, authenticated;
grant select on table public.saved_places to authenticated;
grant select, insert, update, delete on table public.saved_places to service_role;

create policy "users read their own saved places" on public.saved_places
for select to authenticated
using (user_id = (select auth.uid()));
