import { handler, ok } from "../_shared/response.ts";
import { requireAuth, requireCustomer } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { createLiveRazorpayGateway } from "../_shared/razorpay.ts";
import { createRazorpayOrder } from "../_shared/paymentService.ts";

Deno.serve(handler(async (req) => {
  const auth = requireCustomer(await requireAuth(req));
  const body = await req.json().catch(() => ({}));
  return ok(await createRazorpayOrder(createSupabaseDb(), createLiveRazorpayGateway(), auth, body), 200, req);
}));
