import { verifyJwt, JwtClaims } from "./jwt.ts";
import { forbidden, unauthorized } from "./errors.ts";

export interface AuthUser {
  id: string;
  role: "customer" | "driver" | "admin";
  phone: string;
}

function jwtSecret(): string {
  const s = (globalThis as any).Deno?.env?.get?.("JWT_SECRET_KEY");
  if (!s) throw new Error("JWT_SECRET_KEY not configured");
  return s;
}

/** Verifies the Authorization: Bearer <jwt> header. Every protected function calls this first. */
export async function requireAuth(req: Request, secret = jwtSecret()): Promise<AuthUser> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw unauthorized("Missing bearer token");
  const claims: JwtClaims = await verifyJwt(match[1], secret);
  return { id: claims.sub, role: claims.role as AuthUser["role"], phone: claims.phone };
}

export function requireCustomer(user: AuthUser): AuthUser {
  if (user.role !== "customer" && user.role !== "admin") throw forbidden("Customer role required");
  return user;
}
export function requireDriver(user: AuthUser): AuthUser {
  if (user.role !== "driver" && user.role !== "admin") throw forbidden("Driver role required");
  return user;
}
export function requireAdmin(user: AuthUser): AuthUser {
  if (user.role !== "admin") throw forbidden("Admin role required");
  return user;
}
