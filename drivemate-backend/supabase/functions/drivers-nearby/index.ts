import { handler, ok } from "../_shared/response.ts";
import { requireAuth } from "../_shared/roleGuards.ts";
import { createSupabaseDb } from "../_shared/supabaseDb.ts";
import { nearbyDrivers } from "../_shared/driverService.ts";

Deno.serve(handler(async (req) => {
  await requireAuth(req); // any authenticated role may browse drivers
  const url = new URL(req.url);
  const result = await nearbyDrivers(createSupabaseDb(), {
    latitude: url.searchParams.get("latitude"),
    longitude: url.searchParams.get("longitude"),
    radiusKm: url.searchParams.get("radiusKm"),
    serviceType: url.searchParams.get("serviceType"),
    dropLatitude: url.searchParams.get("dropLatitude"),
    dropLongitude: url.searchParams.get("dropLongitude"),
  });
  return ok(result, 200, req);
}));
