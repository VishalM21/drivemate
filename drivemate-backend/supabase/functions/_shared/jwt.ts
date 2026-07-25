// Self-issued HS256 JWT (sign + verify) using WebCrypto only — no dependencies.
import { unauthorized } from "./errors.ts";

const enc = new TextEncoder();

function b64url(data: Uint8Array): string {
  let s = "";
  data.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export interface JwtClaims {
  sub: string;      // user id
  role: string;     // customer | driver | admin
  phone: string;
  iat: number;
  exp: number;
  [k: string]: unknown;
}

export async function signJwt(
  payload: { sub: string; role: string; phone: string },
  secret: string,
  expireMinutes: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = { ...payload, iat: now, exp: now + expireMinutes * 60 };
  const header = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${header}.${body}`)));
  return `${header}.${body}.${b64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw unauthorized("Malformed token");
  const [h, b, s] = parts;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, b64urlDecode(s) as unknown as BufferSource, enc.encode(`${h}.${b}`));
  if (!valid) throw unauthorized("Invalid token signature");
  let claims: JwtClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(b64urlDecode(b)));
  } catch {
    throw unauthorized("Invalid token payload");
  }
  const hdr = JSON.parse(new TextDecoder().decode(b64urlDecode(h)));
  if (hdr.alg !== "HS256") throw unauthorized("Unsupported token algorithm");
  if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) {
    throw unauthorized("Token expired");
  }
  return claims;
}
