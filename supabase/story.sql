-- =====================================================================
-- STORY MODE (run once in Supabase: Dashboard > SQL Editor > New query)
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
