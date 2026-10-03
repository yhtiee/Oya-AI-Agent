-- Waitlist + survey for the Oya landing page.
--
-- The table is private: row level security is on and there are no policies, so the
-- anon and authenticated roles can't read or write it directly. The landing page
-- signs people up only through public.join_waitlist(), which validates input,
-- ignores duplicate emails and returns how many people from the same area are waiting.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text not null check (char_length(btrim(name)) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+234[789][01][0-9]{8}$'),
  area text not null check (char_length(btrim(area)) between 2 and 120),

  -- Survey answers. Keep these lists in sync with lib/waitlist.ts.
  needs text[] not null check (
    cardinality(needs) between 1 and 3
    and needs <@ array[
      'power', 'food', 'artisans', 'government', 'pharmacy', 'health', 'housing', 'gas',
      'fuel', 'transport', 'school', 'jobs', 'prices', 'events', 'beauty', 'other'
    ]
  ),
  current_ways text[] not null default '{}' check (
    current_ways <@ array['ask_people', 'whatsapp_groups', 'call_around', 'go_in_person', 'search_online', 'pay_agent']
  ),
  first_ask text check (first_ask is null or char_length(first_ask) <= 500),
  languages text[] not null default '{}' check (
    languages <@ array['pidgin', 'english', 'yoruba', 'igbo', 'hausa', 'efik_ibibio']
  ),

  consent boolean not null check (consent),
  source text not null default 'landing' check (char_length(source) <= 40)
);

comment on table public.waitlist is 'Early access signups and survey answers from the landing page.';

create unique index waitlist_email_key on public.waitlist (lower(email));
create index waitlist_area_idx on public.waitlist (lower(btrim(area)));
create index waitlist_created_at_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;
revoke all on table public.waitlist from anon, authenticated;


-- The only way in from the website.
create function public.join_waitlist(
  p_name text,
  p_email text,
  p_whatsapp text,
  p_area text,
  p_needs text[],
  p_current_ways text[],
  p_first_ask text,
  p_languages text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean;
  v_area_count integer;
begin
  insert into public.waitlist (name, email, whatsapp, area, needs, current_ways, first_ask, languages, consent)
  values (
    btrim(p_name),
    lower(btrim(p_email)),
    nullif(btrim(p_whatsapp), ''),
    btrim(p_area),
    p_needs,
    coalesce(p_current_ways, '{}'),
    nullif(btrim(p_first_ask), ''),
    coalesce(p_languages, '{}'),
    true
  )
  on conflict ((lower(email))) do nothing
  returning true into v_inserted;

  select count(*) into v_area_count
  from public.waitlist
  where lower(btrim(area)) = lower(btrim(p_area));

  return jsonb_build_object(
    'status', case when v_inserted then 'joined' else 'already' end,
    'area_count', v_area_count
  );
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text[], text[], text, text[]) from public;
grant execute on function public.join_waitlist(text, text, text, text, text[], text[], text, text[]) to anon, authenticated;


-- Insights for the team, readable from the dashboard or with the service role.
create view public.waitlist_needs with (security_invoker = true) as
select need, count(*)::int as signups
from public.waitlist, unnest(needs) as need
group by need
order by signups desc;

create view public.waitlist_current_ways with (security_invoker = true) as
select way, count(*)::int as signups
from public.waitlist, unnest(current_ways) as way
group by way
order by signups desc;

create view public.waitlist_areas with (security_invoker = true) as
select initcap(lower(btrim(area))) as area, count(*)::int as signups, max(created_at) as latest_signup
from public.waitlist
group by 1
order by signups desc;

revoke all on public.waitlist_needs, public.waitlist_current_ways, public.waitlist_areas from anon, authenticated;
