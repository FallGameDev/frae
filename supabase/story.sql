-- =====================================================================
-- STORY MODE + SHOP (run in Supabase: Dashboard > SQL Editor > New query.
-- Safe to run again: it only adds what is missing.)
-- Adds to every profile:
--   exp    total EXP earned in Story Mode
--   story  { "beaten": { "1-3": 2, ... } }  = tape-night -> times beaten
--          (night 6 = the 6th night, night 7 = the custom night)
-- Players can NOT change exp or story themselves: only story_win() can,
-- and it decides how much EXP a night is worth.
-- =====================================================================

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

-- =====================================================================
-- OG BONUS: play between Oct 24 and Nov 10, 2026 (Eastern time) and get
-- 500 EXP, once per account. The database checks the date with its own
-- clock, so changing the computer's clock does nothing.
--   og  true once the bonus was given
-- Only og_bonus() can change it. Safe to run again.
-- =====================================================================
alter table public.profiles add column if not exists og boolean not null default false;

create or replace function public.og_bonus()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  got boolean;
  new_exp int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- the window: Oct 24 12:00 AM EDT to the end of Nov 10 (EST, clocks go back Nov 1)
  if now() < '2026-10-24 00:00:00-04'::timestamptz or now() >= '2026-11-11 00:00:00-05'::timestamptz then
    return jsonb_build_object('gained', 0, 'reason', 'closed');
  end if;
  select og into got from public.profiles where id = auth.uid() for update;
  if got then return jsonb_build_object('gained', 0, 'reason', 'claimed'); end if;
  update public.profiles set og = true, exp = exp + 500
   where id = auth.uid() returning exp into new_exp;
  return jsonb_build_object('gained', 500, 'exp', new_exp);
end $$;
revoke execute on function public.og_bonus() from anon;
grant execute on function public.og_bonus() to authenticated;
