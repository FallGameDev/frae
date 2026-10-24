-- =====================================================================
-- Fried Rice at Eddie's: accounts (Supabase)
-- Run this ONCE in your Supabase project: Dashboard > SQL Editor > New query,
-- paste all of this, press Run. Then put the project URL and anon key in
-- CLOUD_CONFIG at the top of tools/global.js.
--
-- What it makes:
--   profiles  one row per player: username, when they joined
--   saves     every synced save file / settings blob (key -> JSON)
--   mods      the mods backed up to the account (the files are in storage)
--   storage bucket "mods": one private .zip per mod, in a folder per player
-- Row Level Security: every player can only see and change their own rows.
-- =====================================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  constraint username_ok check (username ~ '^[A-Za-z0-9_]{3,20}$')
);
-- usernames are unique no matter the capital letters
create unique index if not exists profiles_username_unique on public.profiles (lower(username));

alter table public.profiles enable row level security;
drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- A new account gets its profile from the username typed on the sign up form
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  name text := coalesce(new.raw_user_meta_data ->> 'username', '');
begin
  -- bad or taken name: fall back to player_<random>
  if name !~ '^[A-Za-z0-9_]{3,20}$' or exists (select 1 from public.profiles where lower(username) = lower(name)) then
    name := 'player_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  insert into public.profiles (id, username) values (new.id, name);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- The sign up form checks a name before making the account (works signed out)
create or replace function public.username_taken(name text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where lower(username) = lower(name));
$$;
grant execute on function public.username_taken(text) to anon, authenticated;

-- ---------- SAVES (save files + settings, synced from localStorage) ----------
create table if not exists public.saves (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,                 -- like "frae1-save-file2", "frae2-settings", "frae-global"
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint key_ok check (key ~ '^(frae[0-9]+-save-file[0-9]+|frae[0-9]+-settings|frae-global)$')
);
alter table public.saves enable row level security;
drop policy if exists "own saves" on public.saves;
create policy "own saves" on public.saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- MODS (details; the zip itself is in the "mods" storage bucket) ----------
create table if not exists public.mods (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,                  -- the mod's id in the game (like "m1abc2de3")
  tape int not null,                 -- 1 or 2
  name text not null,
  author text not null default '',
  version text not null default '',
  kind text not null default 'installed' check (kind in ('installed', 'created')),
  size bigint not null default 0,
  path text not null,                -- storage path: <user id>/<tape>-<mod id>.zip
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.mods enable row level security;
drop policy if exists "own mods" on public.mods;
create policy "own mods" on public.mods for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- STORAGE: private bucket, one folder per player ----------
insert into storage.buckets (id, name, public) values ('mods', 'mods', false)
  on conflict (id) do nothing;
drop policy if exists "own mod files read" on storage.objects;
drop policy if exists "own mod files add" on storage.objects;
drop policy if exists "own mod files change" on storage.objects;
drop policy if exists "own mod files delete" on storage.objects;
create policy "own mod files read" on storage.objects for select to authenticated
  using (bucket_id = 'mods' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own mod files add" on storage.objects for insert to authenticated
  with check (bucket_id = 'mods' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own mod files change" on storage.objects for update to authenticated
  using (bucket_id = 'mods' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own mod files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'mods' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- DELETE ACCOUNT (the menu deletes the mod files first) ----------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();   -- profiles, saves and mods rows go with it (cascade)
end $$;
revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

-- =====================================================================
-- WORKSHOP: published mods anyone can browse and install (no account
-- needed to look). Publishing needs an account; the author is always
-- the publisher's username. Mature mods never show in the list, only
-- through their link (workshop_get), or to the person who made them.
-- Safe to run again.
-- =====================================================================
create table if not exists public.workshop (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tape int not null check (tape between 1 and 4),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 2000),
  version text not null default '' check (char_length(version) <= 20),
  author text not null default '',          -- always the publisher's username (set by the trigger below)
  mature boolean not null default false,    -- true = hidden from the list, link only
  has_code boolean not null default false,  -- the mod runs its own code (players are warned)
  size bigint not null default 0,
  path text not null,                       -- public storage path: workshop/<user id>/<workshop id>.zip
  source_mod text not null default '',      -- the publisher's local mod id it came from
  downloads int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workshop_list on public.workshop (tape, mature, created_at desc);

alter table public.workshop enable row level security;
drop policy if exists "workshop read" on public.workshop;
drop policy if exists "workshop add" on public.workshop;
drop policy if exists "workshop change" on public.workshop;
drop policy if exists "workshop delete" on public.workshop;
create policy "workshop read" on public.workshop for select using (not mature or auth.uid() = user_id);
create policy "workshop add" on public.workshop for insert to authenticated with check (auth.uid() = user_id);
create policy "workshop change" on public.workshop for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workshop delete" on public.workshop for delete to authenticated using (auth.uid() = user_id);

-- The author is the publisher's username, and players can't fake the download count
create or replace function public.workshop_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author := coalesce((select username from public.profiles where id = new.user_id), 'player');
  if tg_op = 'INSERT' then
    new.downloads := 0;
    new.created_at := now();
  elsif coalesce(current_setting('frae.counting', true), '') <> '1' then
    new.downloads := old.downloads;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists workshop_guard on public.workshop;
create trigger workshop_guard before insert or update on public.workshop
  for each row execute function public.workshop_guard();

-- Changing your username changes the author on your published mods too
create or replace function public.workshop_rename()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.username is distinct from old.username then
    update public.workshop set author = new.username where user_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists workshop_rename on public.profiles;
create trigger workshop_rename after update on public.profiles
  for each row execute function public.workshop_rename();

-- One mod by its link (works for mature mods too)
create or replace function public.workshop_get(mod_id uuid)
returns setof public.workshop language sql security definer set search_path = public stable as $$
  select * from public.workshop where id = mod_id;
$$;
grant execute on function public.workshop_get(uuid) to anon, authenticated;

-- +1 download (anyone)
create or replace function public.workshop_downloaded(mod_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('frae.counting', '1', true);
  update public.workshop set downloads = downloads + 1 where id = mod_id;
end $$;
grant execute on function public.workshop_downloaded(uuid) to anon, authenticated;

-- Storage: public bucket (anyone can download), players upload only into their own folder
insert into storage.buckets (id, name, public, file_size_limit) values ('workshop', 'workshop', true, 52428800)
  on conflict (id) do update set public = true;
drop policy if exists "own workshop files add" on storage.objects;
drop policy if exists "own workshop files change" on storage.objects;
drop policy if exists "own workshop files delete" on storage.objects;
drop policy if exists "own workshop files read" on storage.objects;
create policy "own workshop files read" on storage.objects for select to authenticated
  using (bucket_id = 'workshop' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own workshop files add" on storage.objects for insert to authenticated
  with check (bucket_id = 'workshop' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own workshop files change" on storage.objects for update to authenticated
  using (bucket_id = 'workshop' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own workshop files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'workshop' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- STORY MODE (also in supabase/story.sql) ----------

alter table public.profiles add column if not exists exp integer not null default 0;
alter table public.profiles add column if not exists story jsonb not null default '{}'::jsonb;

-- players can still change their username, but nothing else on the profile
revoke update on public.profiles from authenticated, anon;
grant update (username) on public.profiles to authenticated;

-- Beat a night in Story Mode: adds EXP and counts the win.
-- First time beating that night = full EXP, every time after = a quarter.
create or replace function public.story_win(tape int, night int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k text := tape || '-' || night;
  base int;
  times int;
  gained int;
  new_exp int;
  new_story jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if tape not in (1, 2) or night < 1 or night > 7 then raise exception 'no such night'; end if;
  -- EXP for nights 1, 2, 3, 4, 5, 6th night, custom night (Tape 2 is worth double)
  base := (array[50, 75, 100, 150, 200, 300, 250])[night] * (case when tape = 2 then 2 else 1 end);
  select coalesce((story -> 'beaten' ->> k)::int, 0) into times from public.profiles where id = auth.uid() for update;
  gained := case when times = 0 then base else base / 4 end;
  update public.profiles
     set exp = exp + gained,
         story = jsonb_set(coalesce(story, '{}'::jsonb), '{beaten}',
                           coalesce(story -> 'beaten', '{}'::jsonb) || jsonb_build_object(k, times + 1))
   where id = auth.uid()
   returning exp, story into new_exp, new_story;
  return jsonb_build_object('gained', gained, 'first', times = 0, 'exp', new_exp, 'story', new_story);
end $$;
revoke execute on function public.story_win(int, int) from anon;
grant execute on function public.story_win(int, int) to authenticated;

-- =====================================================================
-- SHOP (Story Mode hub): trade EXP for items that work in every night
--   spent  EXP spent in the shop (your level still counts ALL EXP: exp)
--   items  { "pan": 2, "trap": 1, ... }
-- Only shop_buy and use_item can change these.
-- =====================================================================
alter table public.profiles add column if not exists spent integer not null default 0;
alter table public.profiles add column if not exists items jsonb not null default '{}'::jsonb;

-- Buy qty of an item. The prices live here (the page only shows them).
create or replace function public.shop_buy(item text, qty int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  price int;
  cost int;
  have_exp int;
  have_spent int;
  new_exp int;
  new_spent int;
  new_items jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  price := case item
    when 'pan' then 600 when 'stopwatch' then 400 when 'battery' then 250
    when 'glasses' then 300 when 'trap' then 350 when 'horn' then 450 else null end;
  if price is null then raise exception 'There is no item called %.', item; end if;
  if qty is null or qty < 1 or qty > 20 then raise exception 'You can buy 1 to 20 at a time.'; end if;
  cost := price * qty;
  select exp, spent into have_exp, have_spent from public.profiles where id = auth.uid() for update;
  if have_exp - have_spent < cost then raise exception 'Not enough EXP.'; end if;
  update public.profiles
     set spent = spent + cost,
         items = coalesce(items, '{}'::jsonb) || jsonb_build_object(item, coalesce((items ->> item)::int, 0) + qty)
   where id = auth.uid()
   returning exp, spent, items into new_exp, new_spent, new_items;
  return jsonb_build_object('exp', new_exp, 'spent', new_spent, 'items', new_items);
end $$;
revoke execute on function public.shop_buy(text, int) from anon;
grant execute on function public.shop_buy(text, int) to authenticated;

-- Use one item (in a night)
create or replace function public.use_item(item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  have int;
  new_items jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select coalesce((items ->> item)::int, 0) into have from public.profiles where id = auth.uid() for update;
  if have < 1 then raise exception 'You have no % left.', item; end if;
  update public.profiles
     set items = items || jsonb_build_object(item, have - 1)
   where id = auth.uid()
   returning items into new_items;
  return jsonb_build_object('items', new_items);
end $$;
revoke execute on function public.use_item(text) from anon;
grant execute on function public.use_item(text) to authenticated;
