-- 周年悄悄话: one sealed line per partner per anniversary (CLAUDE.md §7.258).
-- Apply with:  npx supabase db query --linked -f supabase/sql/2026-09-30-anniv-notes.sql

create table if not exists public.anniv_notes (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  "char"     text not null check ("char" in ('char1', 'char2')),
  -- the anniversary it is for, as a calendar date in the writer's zone
  open_on    date not null,
  -- the writer's UTC offset in minutes when they sealed it: the note opens at
  -- 00:00 on open_on THERE, so the reader's phone clock can't open it early
  tz_min     integer not null default 480 check (tz_min between -720 and 840),
  text       text not null check (char_length(text) between 1 and 200),
  updated_at timestamptz not null default now(),
  unique (match_id, "char", open_on)
);

-- RLS on with NO policies: a session token can neither read nor write this
-- table directly. Only the anniv-note function (service role) touches it,
-- because a direct SELECT would hand the partner the note before the day.
alter table public.anniv_notes enable row level security;
