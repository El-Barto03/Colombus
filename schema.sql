-- Ambar Madrid Retail Mapping: Supabase database and logo storage setup.
-- Run this entire file once in Supabase > SQL Editor.

begin;

create table if not exists public.shops (
  id text primary key,
  name text not null,
  category text not null default 'shop'
    check (category in ('shop', 'museum', 'airport', 'train_station')),
  initials text not null,
  logo text not null default '',
  logo_text text not null default '',
  logo_background text not null default 'light'
    check (logo_background in ('light', 'dark')),
  type text not null default '',
  product_range text not null default '',
  price_range text not null default '',
  contact text not null default '',
  fit text not null default '',
  address text not null,
  neighborhood text not null default '',
  website text not null default '',
  directions_url text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  note text not null default '',
  visit_status text not null default 'not_visited'
    check (visit_status in ('visited', 'not_visited')),
  reach_out_sent boolean not null default false,
  followup_sent boolean not null default false,
  manual_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_state (
  key text primary key,
  value text not null
);

create index if not exists shops_name_idx on public.shops (name);
create index if not exists shops_category_idx on public.shops (category);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shops_set_updated_at on public.shops;
create trigger shops_set_updated_at
before update on public.shops
for each row execute function public.set_updated_at();

alter table public.shops enable row level security;
alter table public.app_state enable row level security;
revoke all on table public.shops from anon, authenticated;
revoke all on table public.app_state from anon, authenticated;
grant select, insert, update, delete on table public.shops to service_role;
grant select, insert, update, delete on table public.app_state to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-logos',
  'shop-logos',
  true,
  2000000,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
