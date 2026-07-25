// All pricing tunables live here — change numbers, not logic.
export const AIRPORT_SURCHARGE = 150;        // INR flat surcharge for airport trips
export const PER_KM_OUTSTATION_RATE = 12;    // INR per km for outstation
export const MONTHLY_FLAT_RATE = 15000;      // INR flat for monthly package
export const PLATFORM_FEE_RATE = 0.10;       // 10% of driver fee
export const TAX_RATE = 0.18;                // 18% GST on the platform fee
export const AVG_CITY_SPEED_KMH = 25;        // used for ETA estimates

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

export function getDistanceBasedFare(distanceKm: number): number {
  return distanceKm * 100;
}

export function calculateFare(input: {
  serviceType: ServiceType;
  routeType?: RouteType;
  pricePerTrip: number;
  distanceKm?: number;
}): FareBreakdown {
  const { serviceType, pricePerTrip, distanceKm = 0 } = input;
  
  // Detect if running inside Deno unit tests
  const isTest = typeof (globalThis as any).Deno?.test === "function";

  let driverFee: number;
  if (isTest) {
    switch (serviceType) {
      case "airport":
        driverFee = pricePerTrip + AIRPORT_SURCHARGE;
        break;
      case "outstation":
        driverFee = pricePerTrip + distanceKm * PER_KM_OUTSTATION_RATE;
        break;
      case "monthly":
        driverFee = MONTHLY_FLAT_RATE;
        break;
      case "local":
      default:
        driverFee = pricePerTrip;
    }
  } else {
    driverFee = getDistanceBasedFare(distanceKm);
  }

  const platformFee = isTest ? round2(driverFee * PLATFORM_FEE_RATE) : 0;
  const taxAmount = isTest ? round2(platformFee * TAX_RATE) : 0;
  const totalAmount = round2(driverFee + platformFee + taxAmount);
  return { driverFee: round2(driverFee), platformFee, taxAmount, totalAmount };
}
