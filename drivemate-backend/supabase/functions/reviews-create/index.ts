import { handler, ok } from "../_shared/response.ts";
import { requireAuth, requireCustomer } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { createReview } from "../_shared/reviewService.ts";

Deno.serve(handler(async (req) => {
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  return ok(await createReview(createSupabaseDb(), auth, body), 201, req);
}));
