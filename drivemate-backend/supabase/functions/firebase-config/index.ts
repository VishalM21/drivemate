import { handler, ok } from "../_shared/response.ts";

Deno.serve(handler(async (req) => {
  return ok({
    apiKey: Deno.env.get("FIREBASE_API_KEY") || null,
    authDomain: Deno.env.get("FIREBASE_AUTH_DOMAIN") || null,
    projectId: Deno.env.get("FIREBASE_PROJECT_ID") || null,
    storageBucket: Deno.env.get("FIREBASE_STORAGE_BUCKET") || null,
    messagingSenderId: Deno.env.get("FIREBASE_MESSAGING_SENDER_ID") || null,
    appId: Deno.env.get("FIREBASE_APP_ID") || null,
  }, 200, req);
}));
