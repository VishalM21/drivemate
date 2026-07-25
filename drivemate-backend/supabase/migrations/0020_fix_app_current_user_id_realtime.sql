-- app_current_user_id() only ever read the custom `request.app_user_id` GUC,
-- which nothing in this codebase actually sets (edge functions use the
-- service-role key and bypass RLS entirely). The one real caller of these
-- RLS policies is Supabase Realtime's postgres_changes authorization, which
-- connects with the anon key + this app's self-issued JWT and populates the
-- *standard* `request.jwt.claims` GUC from it (same convention PostgREST
-- uses) — but nothing here ever read that, so every RLS check quietly
-- evaluated to NULL and silently dropped every realtime broadcast for every
-- table, for every user. Falling back to the standard claims GUC fixes this
-- without touching the (currently unused) request.app_user_id path.
create or replace function app_current_user_id() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.app_user_id', true), '')::uuid,
    nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
  )
$$;
