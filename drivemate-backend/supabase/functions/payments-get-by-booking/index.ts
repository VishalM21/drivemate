import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { getPaymentByBooking } from "../_shared/paymentService.ts";

Deno.serve(handler(async (req) => {
  const auth = await requireAuth(req);
  const url = new URL(req.url);
  return ok(await getPaymentByBooking(createSupabaseDb(), auth, url.searchParams.get("bookingId")), 200, req);
}));
