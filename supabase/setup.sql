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
