// Public endpoint (verify_jwt = false in config.toml) — Razorpay calls this
// directly, so there's no bearer token. Authenticity comes from the
// X-Razorpay-Signature HMAC over the raw body instead; see
// _shared/razorpay.ts#verifyWebhookSignature and paymentService.ts#handleRazorpayWebhook.
import { handler, ok } from "../_shared/response.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { defaultNotifier } from "../_shared/notify.ts";
import { createLiveRazorpayGateway } from "../_shared/razorpay.ts";
import { handleRazorpayWebhook } from "../_shared/paymentService.ts";

Deno.serve(handler(async (req) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  return ok(await handleRazorpayWebhook(createSupabaseDb(), defaultNotifier, createLiveRazorpayGateway(), rawBody, signature), 200, req);
}));
