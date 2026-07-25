import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { reviewsByDriver } from "../_shared/reviewService.ts";

Deno.serve(handler(async (req) => {
  await requireAuth(req);
  const url = new URL(req.url);
  return ok(await reviewsByDriver(createSupabaseDb(), url.searchParams.get("driverId")), 200, req);
}));
