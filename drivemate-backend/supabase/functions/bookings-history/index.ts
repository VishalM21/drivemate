import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { bookingHistory } from "../_shared/bookingService.ts";

Deno.serve(handler(async (req) => {
  const auth = await requireAuth(req);
  return ok(await bookingHistory(createSupabaseDb(), auth), 200, req);
}));
