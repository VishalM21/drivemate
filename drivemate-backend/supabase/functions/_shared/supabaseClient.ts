// Service-role Supabase client for Edge Functions (bypasses RLS; app-level
// ownership checks + role guards are the primary enforcement, RLS is backup).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = Deno.env.get("LOCAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
