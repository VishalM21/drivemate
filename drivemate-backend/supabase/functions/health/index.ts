import { handler, ok } from "../_shared/response.ts";
Deno.serve(handler(async (req) => ok({ status: "healthy", time: new Date().toISOString() }, 200, req)));
