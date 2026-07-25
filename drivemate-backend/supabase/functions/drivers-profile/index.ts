import { handler, ok } from "../_shared/response.ts";
import { requireAuth, requireDriver } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { upsertProfile } from "../_shared/driverService.ts";

Deno.serve(handler(async (req) => {
  const auth = requireDriver(await requireAuth(req));
  const body = await req.json().catch(() => ({}));
  return ok(await upsertProfile(createSupabaseDb(), auth, body), 200, req);
}));
