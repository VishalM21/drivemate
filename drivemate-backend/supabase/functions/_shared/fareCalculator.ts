// All pricing tunables live here — change numbers, not logic. The surge
// multiplier itself (the "how much demand bumps the price" logic) lives in
// dynamicPricing.ts, kept separate on purpose so it can be tuned/rewritten
// without touching this base-rate math.
export const BASE_FARE = 60;                 // INR flat pickup fee (local/airport)
export const PER_KM_RATE = 14;                // INR per km (local/airport)
export const AIRPORT_SURCHARGE = 150;         // INR flat surcharge for airport trips
export const OUTSTATION_BASE_FARE = 200;      // INR flat pickup fee for outstation
export const PER_KM_OUTSTATION_RATE = 12;     // INR per km for outstation
export const MONTHLY_FLAT_RATE = 15000;       // INR flat for monthly package (not surged)
export const PLATFORM_FEE_RATE = 0.10;        // 10% of driver fee
export const TAX_RATE = 0.18;                 // 18% GST on the platform fee
export const AVG_CITY_SPEED_KMH = 25;         // used for ETA estimates

export type ServiceType = "local" | "outstation" | "airport" | "monthly";
export type RouteType = "one_way" | "round_trip" | "hourly";

export interface FareBreakdown {
  driverFee: number;
  platformFee: number;
  taxAmount: number;
  totalAmount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function etaMinutes(distanceKm: number): number {
  return Math.max(1, Math.round((distanceKm / AVG_CITY_SPEED_KMH) * 60));
}

/** Base driver fare before surge — platform rate card, not driver-set. */
function baseDriverFare(serviceType: ServiceType, distanceKm: number): number {
  switch (serviceType) {
    case "airport":
      return BASE_FARE + AIRPORT_SURCHARGE + distanceKm * PER_KM_RATE;
    case "outstation":
      return OUTSTATION_BASE_FARE + distanceKm * PER_KM_OUTSTATION_RATE;
    case "monthly":
      return MONTHLY_FLAT_RATE;
    case "local":
    default:
      return BASE_FARE + distanceKm * PER_KM_RATE;
  }
}

export function calculateFare(input: {
  serviceType: ServiceType;
  routeType?: RouteType;
  distanceKm?: number;
  /** From dynamicPricing.computeSurgeMultiplier() — 1.0 = no surge. Not
   * applied to "monthly" (flat subscription-style package). */
  surgeMultiplier?: number;
}): FareBreakdown {
  const { serviceType, distanceKm = 0 } = input;
  const surge = serviceType === "monthly" ? 1 : Math.max(1, input.surgeMultiplier ?? 1);

  const driverFee = round2(baseDriverFare(serviceType, distanceKm) * surge);
  const platformFee = round2(driverFee * PLATFORM_FEE_RATE);
  const taxAmount = round2(platformFee * TAX_RATE);
  const totalAmount = round2(driverFee + platformFee + taxAmount);

  return { driverFee, platformFee, taxAmount, totalAmount };
}
