-- 我们的家 (and later 照片拼图 / 关卡编辑): one save per couple per game.
-- Apply with:  npx supabase db query --linked -f supabase/sql/2026-11-25-game-saves.sql
--
-- A save is a small JSON document both partners' phones read and write. `rev`
-- makes every write a compare-and-set: a phone sends the rev it read, and a
-- write against an older rev is refused with the newer save, so two phones
-- watering the garden at the same moment can never silently undo each other
-- (the function replays the loser's action on top of the winner's save).

create table if not exists public.game_saves (
  match_id   uuid not null references public.matches(id) on delete cascade,
  game       text not null check (game ~ '^[a-z][a-z0-9_]{0,23}$'),
  slot       text not null default '' check (slot ~ '^[a-z0-9_-]{0,40}$'),
  data       jsonb not null default '{}'::jsonb,
  rev        integer not null default 1 check (rev >= 1),
  updated_by text not null default '' check (updated_by in ('', 'char1', 'char2')),
  updated_at timestamptz not null default now(),
  primary key (match_id, game, slot)
);

-- RLS on with NO policies: a session token can neither read nor write this
-- table directly. Only the game-save function (service role) touches it, and
-- it is the one place the save's rules are kept (a flower count that only
-- grows, a size cap, the compare-and-set).
alter table public.game_saves enable row level security;
