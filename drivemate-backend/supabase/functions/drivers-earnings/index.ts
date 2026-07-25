import { handler, ok } from "../_shared/response.ts";
import { requireAuth, requireDriver } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { earnings } from "../_shared/driverService.ts";

Deno.serve(handler(async (req) => {
  const auth = requireDriver(await requireAuth(req));
  return ok(await earnings(createSupabaseDb(), auth), 200, req);
}));
