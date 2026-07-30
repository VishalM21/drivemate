// Surge pricing lives here, isolated from fareCalculator.ts (base rates) and
// bookingService.ts (booking flow) on purpose — this is the one file to
// touch when you want to change HOW surge is computed (the ratio, the
// bands, the radius, swap in a smarter algorithm later, etc.) without
// risking the base fare math or the booking transaction logic.
import type { Db } from "./db.ts";

export interface SurgeInput {
  latitude: number;
  longitude: number;
  serviceType: string;
  /** How far around the pickup point counts as "nearby" for both supply and
   * demand. Wider = smoother/less spiky surge, narrower = more local/reactive. */
  radiusKm?: number;
}

const DEFAULT_RADIUS_KM = 5;

// Demand/supply ratio -> multiplier. Evaluated top-down, first match wins.
// Tune freely: add bands, change thresholds, change multipliers.
const SURGE_BANDS: { minRatio: number; multiplier: number }[] = [
  { minRatio: 4, multiplier: 2.0 },
  { minRatio: 2.5, multiplier: 1.5 },
  { minRatio: 1.5, multiplier: 1.2 },
  { minRatio: 0, multiplier: 1.0 },
];

/**
 * Real-time surge multiplier for a pickup point: ratio of open ride
 * requests to available online drivers nearby, mapped through SURGE_BANDS.
 * Computed fresh per quote/booking (no caching/precomputed zones) — simple
 * and honest for this app's scale; swap in a smarter/precomputed version
 * here later without touching any caller.
 */
export async function computeSurgeMultiplier(db: Db, input: SurgeInput): Promise<number> {
  const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;

  const [nearbyDrivers, pendingRequests] = await Promise.all([
    db.findNearbyDrivers(input.latitude, input.longitude, radiusKm, input.serviceType),
    db.countPendingBookingsNear(input.latitude, input.longitude, radiusKm),
  ]);

  const availableDrivers = nearbyDrivers.length;
  if (availableDrivers === 0) {
    return pendingRequests > 0 ? SURGE_BANDS[0].multiplier : 1.0;
  }

  const ratio = pendingRequests / availableDrivers;
  for (const band of SURGE_BANDS) {
    if (ratio >= band.minRatio) return band.multiplier;
  }
  return 1.0;
}
