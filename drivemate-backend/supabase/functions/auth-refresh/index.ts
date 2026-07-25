import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { refreshSession } from "../_shared/authService.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAdmin.ts";

Deno.serve(handler(async (req) => {
  const auth = await requireAuth(req);
  const result = await refreshSession({
    db: createSupabaseDb(),
    verifyIdToken: verifyFirebaseIdToken,
    jwtSecret: Deno.env.get("JWT_SECRET_KEY")!,
    expireMinutes: Number(Deno.env.get("ACCESS_TOKEN_EXPIRE_MINUTES") ?? 1440),
  }, auth);
  return ok(result, 200, req);
}));
