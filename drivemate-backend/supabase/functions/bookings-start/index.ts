import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { defaultNotifier } from "../_shared/notify.ts";
import { startTrip } from "../_shared/bookingService.ts";

Deno.serve(handler(async (req) => {
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  return ok(await startTrip(createSupabaseDb(), defaultNotifier, auth, body), 200, req);
}));
