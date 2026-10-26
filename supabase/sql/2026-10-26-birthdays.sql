-- 生日惊喜 (CLAUDE.md §7.30): both birthdays, and what one partner seals for
-- the other's. Apply with:
--   npx supabase db query --linked -f supabase/sql/2026-10-26-birthdays.sql

-- 'MM-DD', or 'YYYY-MM-DD' when a year was given (that turns on 「第 N 个生日」).
-- Validated by the config function; '' = not set.
alter table public.config add column if not exists birthday_1 text not null default '';
alter table public.config add column if not exists birthday_2 text not null default '';

create table if not exists public.surprises (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references public.matches(id) on delete cascade,
  -- who prepared it; it is for the other partner
  from_char    text not null check (from_char in ('char1', 'char2')),
  -- the birthday it is for, as a calendar date in the writer's zone
  open_on      date not null,
  -- the writer's UTC offset in minutes when they sealed it: it opens at 00:00
  -- on open_on THERE, so the birthday person's phone clock cannot open it early
  tz_min       integer not null default 480 check (tz_min between -720 and 840),
  letter       text not null default '' check (char_length(letter) <= 800),
  coupon_title text not null default '' check (char_length(coupon_title) <= 30),
  coupon_note  text not null default '' check (char_length(coupon_note) <= 80),
  coupon_icon  text not null default '' check (char_length(coupon_icon) <= 16),
  photo_ids    uuid[] not null default '{}' check (cardinality(photo_ids) <= 12),
  teaser       boolean not null default false,
  -- set once, by the first opening; the coupon goes into the bag in the same step
  opened_at    timestamptz,
  updated_at   timestamptz not null default now(),
  unique (match_id, from_char, open_on)
);

-- RLS on with NO policies: a session token can neither read nor write this
-- table directly. Only the surprise function (service role) touches it,
-- because a direct SELECT would hand the birthday person the surprise early.
alter table public.surprises enable row level security;

-- The coupon lands in the birthday person's bag as source_type 'gift'. The
-- allowed list is enumerated from every writer (shop-buy 'purchase', bag-claim
-- 'reward', decor-buy 'decor', surprise 'gift') — the migration once shipped a
-- check that silently outlawed real data (§9.06).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.bag'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source_type%'
  loop
    execute format('alter table public.bag drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.bag add constraint bag_source_type_check
  check (source_type in ('purchase', 'reward', 'decor', 'gift'));
