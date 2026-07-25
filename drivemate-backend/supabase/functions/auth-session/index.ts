import { handler, ok } from "../_shared/response.ts";
import { badRequest } from "../_shared/errors.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAdmin.ts";
import { createSession } from "../_shared/authService.ts";

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw badRequest("POST required");
  const body = await req.json().catch(() => ({}));
  const result = await createSession({
    db: createSupabaseDb(),
    verifyIdToken: verifyFirebaseIdToken,
    jwtSecret: Deno.env.get("JWT_SECRET_KEY")!,
    expireMinutes: Number(Deno.env.get("ACCESS_TOKEN_EXPIRE_MINUTES") ?? 1440),
  }, body);
  return ok(result, 200, req);
}));
