// Firebase without the Node SDK: pure fetch + WebCrypto (Deno-native).
// 1) verifyFirebaseIdToken — validates Phone-Auth ID tokens against Google's
//    securetoken JWKs (RS256), checking iss/aud/exp.
// 2) sendPush — FCM HTTP v1 API using an OAuth2 access token minted from the
//    service-account private key (RS256 JWT grant).
import { unauthorized } from "./errors.ts";

const JWK_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const enc = new TextEncoder();

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
function b64url(data: Uint8Array): string {
  let s = "";
  data.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let jwkCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;

async function getGoogleJwks(): Promise<JsonWebKey[]> {
  if (jwkCache && Date.now() - jwkCache.fetchedAt < 60 * 60 * 1000) return jwkCache.keys;
  const res = await fetch(JWK_URL);
  if (!res.ok) throw new Error("Failed to fetch Google JWKs");
  const body = await res.json();
  jwkCache = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

export interface FirebaseTokenPayload {
  uid: string;
  phone: string;
  [k: string]: unknown;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseTokenPayload> {
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID not configured");

  const parts = idToken.split(".");
  if (parts.length !== 3) throw unauthorized("Malformed Firebase ID token");
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));

  if (header.alg !== "RS256") throw unauthorized("Unexpected Firebase token alg");
  const jwks = await getGoogleJwks();
  const jwk = jwks.find((k: any) => (k as any).kid === header.kid);
  if (!jwk) throw unauthorized("Unknown Firebase signing key");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlDecode(parts[2]) as unknown as BufferSource,
    enc.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw unauthorized("Invalid Firebase token signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw unauthorized("Firebase token expired");
  if (payload.aud !== projectId) throw unauthorized("Firebase token audience mismatch");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw unauthorized("Firebase token issuer mismatch");
  }
  const phone = (payload.phone_number ?? "").replace(/^\+91/, "").replace(/^\+/, "");
  if (!payload.sub) throw unauthorized("Firebase token missing subject");
  return { uid: payload.sub, phone, ...payload };
}

// ---------------- FCM HTTP v1 ----------------

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function getServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not configured");
  return JSON.parse(raw);
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der as unknown as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;
  const sa = getServiceAccount();
  const header = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const key = await importPkcs8(sa.private_key);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${header}.${claims}`)));
  const assertion = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${await res.text()}`);
  const body = await res.json();
  tokenCache = { token: body.access_token, exp: now + (body.expires_in ?? 3600) };
  return body.access_token;
}

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Sends a push via FCM v1. Returns true on success, false on failure (never throws — pushes are best-effort). */
export async function sendPush(fcmToken: string | null | undefined, msg: PushMessage): Promise<boolean> {
  try {
    if (!fcmToken) return false;
    const sa = getServiceAccount();
    const accessToken = await getAccessToken();
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title: msg.title, body: msg.body },
          data: msg.data ?? {},
        },
      }),
    });
    if (!res.ok) console.error("[fcm] send failed", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("[fcm] error", err);
    return false;
  }
}
