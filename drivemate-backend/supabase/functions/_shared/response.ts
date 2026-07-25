import { ApiError } from "./errors.ts";
import { corsHeaders, isPreflight } from "./cors.ts";

// Consistent { success, data, error } envelope for every endpoint.
export function ok(data: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify({ success: true, data, error: null }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

export function fail(err: unknown, req?: Request): Response {
  const e = err instanceof ApiError ? err : new ApiError(500, "SERVER_ERROR", String((err as Error)?.message ?? err));
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code: e.code, message: e.message } }),
    { status: e.status, headers: { "Content-Type": "application/json", ...corsHeaders(req) } },
  );
}

// Wrapper that gives every edge function: CORS preflight + try/catch + envelope.
export function handler(fn: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (isPreflight(req)) return new Response("ok", { headers: corsHeaders(req) });
    try {
      return await fn(req);
    } catch (err) {
      console.error("[edge-error]", err);
      return fail(err, req);
    }
  };
}
