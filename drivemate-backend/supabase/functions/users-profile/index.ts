import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { updateUserProfile } from "../_shared/authService.ts";

Deno.serve(handler(async (req) => {
  if (req.method !== "POST" && req.method !== "PATCH") {
    return new Response("Method not allowed", { status: 405 });
  }
  const auth = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const updatedUser = await updateUserProfile(createSupabaseDb(), auth, body);
  return ok(updatedUser, 200, req);
}));
