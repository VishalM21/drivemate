import { handler, ok } from "../_shared/response.ts";
import { requireAuth, requireCustomer } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { defaultNotifier } from "../_shared/notify.ts";
import { createLiveRazorpayGateway } from "../_shared/razorpay.ts";
import { verifyRazorpayPayment } from "../_shared/paymentService.ts";

Deno.serve(handler(async (req) => {
  const auth = requireCustomer(await requireAuth(req));
  const body = await req.json().catch(() => ({}));
  return ok(await verifyRazorpayPayment(createSupabaseDb(), defaultNotifier, createLiveRazorpayGateway(), auth, body), 200, req);
}));
