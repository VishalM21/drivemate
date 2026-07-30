import type { Db } from "./db.ts";
import type { AuthUser } from "./roleGuards.ts";
import { badRequest, forbidden, notFound } from "./errors.ts";
import { driverToApi, nearbyDriverToApi } from "./mappers.ts";

import { calculateFare, haversineKm } from "./fareCalculator.ts";
import { computeSurgeMultiplier } from "./dynamicPricing.ts";

export async function nearbyDrivers(
  db: Db,
  q: {
    latitude?: string | null;
    longitude?: string | null;
    radiusKm?: string | null;
    serviceType?: string | null;
    dropLatitude?: string | null;
    dropLongitude?: string | null;
  },
) {
  if (q.latitude == null || q.longitude == null || q.latitude === "" || q.longitude === "") {
    throw badRequest("latitude and longitude are required");
  }
  const lat = Number(q.latitude);
  const lng = Number(q.longitude);
  if (!isFinite(lat) || !isFinite(lng)) throw badRequest("latitude and longitude must be numbers");
  const radiusKm = Math.min(Math.max(Number(q.radiusKm) || 10, 0.5), 100);
  const serviceType = (q.serviceType ?? "").trim();
  const rows = await db.findNearbyDrivers(lat, lng, radiusKm, serviceType);

  let tripDistanceKm = 0;
  const dropLat = q.dropLatitude ? Number(q.dropLatitude) : null;
  const dropLng = q.dropLongitude ? Number(q.dropLongitude) : null;
  if (dropLat != null && dropLng != null && isFinite(dropLat) && isFinite(dropLng)) {
    tripDistanceKm = haversineKm(lat, lng, dropLat, dropLng);
  }

  // One surge read for the whole search — it's about the pickup area, not
  // any individual driver, so every driver in this list quotes the same rate.
  const surgeMultiplier = tripDistanceKm > 0
    ? await computeSurgeMultiplier(db, { latitude: lat, longitude: lng, serviceType: serviceType || "local" })
    : 1;

  const mappedDrivers = rows.map((r) => {
    const apiDriver = nearbyDriverToApi(r);
    if (tripDistanceKm > 0) {
      const fareInfo = calculateFare({
        serviceType: (serviceType || "local") as any,
        distanceKm: tripDistanceKm,
        surgeMultiplier,
      });
      return {
        ...apiDriver,
        tripDistanceKm: Math.round(tripDistanceKm * 10) / 10,
        tripFare: fareInfo.totalAmount,
        surgeMultiplier,
      };
    }
    return apiDriver;
  });

  return { drivers: mappedDrivers };
}

async function ownDriver(db: Db, auth: AuthUser) {
  const driver = await db.getDriverByUserId(auth.id);
  if (!driver) throw notFound("Driver profile not found — create it first via PATCH /drivers-profile");
  return driver;
}

// Note: no pricePerTrip here — drivers don't set their own price, dynamic
// pricing (dynamicPricing.ts) prices every trip. Even if a client sends it,
// it's silently ignored since it's not in this map.
const PROFILE_FIELDS: Record<string, string> = {
  experienceYears: "experience_years",
  languages: "languages",
  licenseNumber: "license_number",
  email: "email",
  serviceLocal: "service_local",
  serviceOutstation: "service_outstation",
  serviceAirport: "service_airport",
  serviceMonthly: "service_monthly",
  serviceNight: "service_night",
};

export async function upsertProfile(db: Db, auth: AuthUser, body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const [apiKey, col] of Object.entries(PROFILE_FIELDS)) {
    if (body[apiKey] !== undefined) patch[col] = body[apiKey];
  }
  const existing = await db.getDriverByUserId(auth.id);
  if (existing) {
    if (Object.keys(patch).length === 0) return driverToApi(existing);
    return driverToApi(await db.updateDriver(existing.id, patch));
  }
  // first-time profile creation
  if (patch.license_number === undefined) throw badRequest("licenseNumber is required to create a driver profile");
  const created = await db.createDriver({ user_id: auth.id, is_verified: true, is_available: false, ...patch });
  return driverToApi(created);
}

export async function setAvailability(db: Db, auth: AuthUser, body: { isAvailable?: boolean }) {
  if (typeof body?.isAvailable !== "boolean") throw badRequest("isAvailable (boolean) is required");
  const driver = await ownDriver(db, auth);
  if (!driver.is_verified && body.isAvailable) throw forbidden("Driver is not verified yet");
  const updated = await db.updateDriver(driver.id, { is_available: body.isAvailable });
  return driverToApi(updated);
}

export async function updateLocation(
  db: Db,
  auth: AuthUser,
  body: { latitude?: number; longitude?: number; heading?: number; speed?: number; accuracy?: number; isOnline?: boolean },
) {
  const { latitude, longitude } = body ?? {};
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw badRequest("latitude and longitude (numbers) are required");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw badRequest("Coordinates out of range");
  }
  const driver = await ownDriver(db, auth);
  const loc = await db.upsertDriverLocation({
    driver_id: driver.id,
    latitude, longitude,
    heading: body.heading ?? null,
    speed: body.speed ?? null,
    accuracy: body.accuracy ?? null,
    is_online: body.isOnline ?? true,
    updated_at: new Date().toISOString(),
  });
  return {
    driverId: loc.driver_id, latitude: loc.latitude, longitude: loc.longitude,
    heading: loc.heading, speed: loc.speed, accuracy: loc.accuracy,
    isOnline: loc.is_online, updatedAt: loc.updated_at,
  };
}

export async function earnings(db: Db, auth: AuthUser, now = new Date()) {
  const driver = await ownDriver(db, auth);
  // Strictly: completed bookings whose COD was collected.
  const rows = await db.listCompletedCollectedByDriver(driver.id);

  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7)); // Monday
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let today = 0, week = 0, month = 0, total = 0;
  for (const b of rows) {
    const fee = Number(b.driver_fee) || 0;
    const at = b.completed_at ? new Date(b.completed_at) : null;
    total += fee;
    if (at && at >= startOfDay) today += fee;
    if (at && at >= startOfWeek) week += fee;
    if (at && at >= startOfMonth) month += fee;
  }
  const totalTrips = rows.length;
  const averagePerTrip = totalTrips ? Math.round((total / totalTrips) * 100) / 100 : 0;
  return { today, week, month, total, totalTrips, averagePerTrip };
}
