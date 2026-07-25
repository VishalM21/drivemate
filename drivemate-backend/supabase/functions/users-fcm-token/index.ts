import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { saveFcmToken } from "../_shared/authService.ts";

Deno.serve(handler(async (req) => {
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  return ok(await saveFcmToken(createSupabaseDb(), auth, body), 200, req);
}));
