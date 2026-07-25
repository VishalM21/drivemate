import { handler, ok } from "../_shared/response.ts";
import { requireAuth, requireCustomer } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { defaultNotifier } from "../_shared/notify.ts";
import { createBooking } from "../_shared/bookingService.ts";

Deno.serve(handler(async (req) => {
  const auth = requireCustomer(await requireAuth(req));
  const body = await req.json().catch(() => ({}));
  return ok(await createBooking(createSupabaseDb(), defaultNotifier, auth, body), 201, req);
}));
