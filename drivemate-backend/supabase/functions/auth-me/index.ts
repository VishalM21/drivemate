import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { me } from "../_shared/authService.ts";

Deno.serve(handler(async (req) => {
  const auth = await requireAuth(req);
  return ok(await me(createSupabaseDb(), auth), 200, req);
}));
