-- A couple's live channel (shared fireworks first; the shared house later).
-- Apply with:  npx supabase db query --remote --yes -f supabase/sql/2026-11-17-live-channel.sql
--
-- Realtime Broadcast on a PRIVATE channel: Realtime checks these policies on
-- realtime.messages when a client joins and when it sends. The topic is
-- "couple:<match id>", and app_match_id() is the caller's own match (the same
-- function the table policies use), so a session can only ever join, hear or
-- send on its own couple's channel. No match → NULL → refused.
-- Nothing is stored: broadcast messages are not written to a table of ours.

drop policy if exists "couple hears its own live channel" on realtime.messages;
create policy "couple hears its own live channel"
  on realtime.messages for select to authenticated
  using ( realtime.topic() = 'couple:' || public.app_match_id()::text );

drop policy if exists "couple sends on its own live channel" on realtime.messages;
create policy "couple sends on its own live channel"
  on realtime.messages for insert to authenticated
  with check ( realtime.topic() = 'couple:' || public.app_match_id()::text );
