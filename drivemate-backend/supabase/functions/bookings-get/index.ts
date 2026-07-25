import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { getBooking } from "../_shared/bookingService.ts";

Deno.serve(handler(async (req) => {
  const auth = await requireAuth(req);
  const url = new URL(req.url);
  return ok(await getBooking(createSupabaseDb(), auth, url.searchParams.get("bookingId") ?? undefined), 200, req);
}));
