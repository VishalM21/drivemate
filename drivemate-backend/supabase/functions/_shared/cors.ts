// Central CORS handling; origins configurable via CORS_ORIGINS env (comma separated or *)
const configured = (globalThis as any).Deno?.env?.get?.("CORS_ORIGINS") ?? "*";

export function corsHeaders(req?: Request): Record<string, string> {
  let allowOrigin = "*";
  if (configured !== "*" && req) {
    const origin = req.headers.get("origin") ?? "";
    const allowed = configured.split(",").map((s: string) => s.trim());
    allowOrigin = allowed.includes(origin) ? origin : allowed[0] ?? "*";
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  };
}

export function isPreflight(req: Request): boolean {
  return req.method === "OPTIONS";
}
