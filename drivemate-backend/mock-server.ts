// In-memory mock server for DriveMate. Exposes all the Supabase Edge Function endpoints
// using MemoryDb, running entirely in-memory with zero Docker / external DB dependencies.
import { handler, ok, fail } from "./supabase/functions/_shared/response.ts";
import { badRequest, unauthorized, ApiError } from "./supabase/functions/_shared/errors.ts";
import { verifyJwt } from "./supabase/functions/_shared/jwt.ts";
import { verifyFirebaseIdToken } from "./supabase/functions/_shared/firebaseAdmin.ts";
import { createSession, refreshSession, me, logout, saveFcmToken, updateUserProfile } from "./supabase/functions/_shared/authService.ts";
import { nearbyDrivers, upsertProfile, setAvailability, updateLocation, earnings } from "./supabase/functions/_shared/driverService.ts";
import { createBooking, getBooking, bookingHistory, acceptBooking, declineBooking, cancelBooking, markArrived, startTrip, completeTrip } from "./supabase/functions/_shared/bookingService.ts";
import { markCodCollected, getPaymentByBooking } from "./supabase/functions/_shared/paymentService.ts";
import { createReview, reviewsByDriver } from "./supabase/functions/_shared/reviewService.ts";
import { MemoryDb, mockNotifier, asAuth } from "./tests/_mocks/memoryDb.ts";
import { corsHeaders } from "./supabase/functions/_shared/cors.ts";

// 1. Load env variables from supabase/functions/.env
try {
  const envText = await Deno.readTextFile("./supabase/functions/.env");
  for (const line of envText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    Deno.env.set(key, val);
  }
  console.log("Loaded environment variables from supabase/functions/.env");
} catch (e) {
  console.log("Warning: Could not read supabase/functions/.env:", e.message);
}

// Ensure critical variables have fallbacks for the mock environment
if (!Deno.env.get("JWT_SECRET_KEY")) {
  Deno.env.set("JWT_SECRET_KEY", "926ae30561448184bc187c5f074e2a28e6c0b7f1e53f0adccbda011a61ed9de0");
}
if (!Deno.env.get("FIREBASE_PROJECT_ID")) {
  Deno.env.set("FIREBASE_PROJECT_ID", "drivemate-8c07f");
}
if (!Deno.env.get("ACCESS_TOKEN_EXPIRE_MINUTES")) {
  Deno.env.set("ACCESS_TOKEN_EXPIRE_MINUTES", "1440");
}

const JWT_SECRET = Deno.env.get("JWT_SECRET_KEY")!;
const EXPIRE_MINUTES = Number(Deno.env.get("ACCESS_TOKEN_EXPIRE_MINUTES"));

// 2. Instantiate and Seed MemoryDb
const db = new MemoryDb();

// Seed Customer
const customerUser = db.seedUser({
  id: "customer-user-id",
  firebase_uid: "mock-uid-9999999999",
  phone: "9999999999",
  role: "customer",
  full_name: "John Customer",
  ride_otp: "1234",
});

// Seed Driver
const driverUser = db.seedUser({
  id: "driver-user-id",
  firebase_uid: "mock-uid-9999999997",
  phone: "9999999997",
  role: "driver",
  full_name: "Ravi Kumar (Driver)",
});
const driverProfile = db.seedDriver({
  id: "driver-profile-id",
  user_id: driverUser.id,
  price_per_trip: 400,
  is_verified: true,
  is_available: true,
  service_local: true,
  service_airport: true,
  service_outstation: true,
});
db.seedLocation({
  driver_id: driverProfile.id,
  latitude: 26.4499,
  longitude: 80.3319,
  is_online: true,
});

// Seed a second driver for nearby search demo
const otherDriverUser = db.seedUser({
  id: "driver-2-user-id",
  firebase_uid: "mock-uid-9999999998",
  phone: "9999999998",
  role: "driver",
  full_name: "Suresh Singh (Driver)",
});
const otherDriverProfile = db.seedDriver({
  id: "driver-2-profile-id",
  user_id: otherDriverUser.id,
  price_per_trip: 500,
  is_verified: true,
  is_available: true,
  service_local: true,
  service_airport: false,
  service_outstation: true,
});
db.seedLocation({
  driver_id: otherDriverProfile.id,
  latitude: 26.46,
  longitude: 80.34,
  is_online: true,
});

console.log("Database seeded with test accounts:");
console.log("- Customer: +91 9999999999 (mock login OTP: 123456, ride OTP: 1234)");
console.log("- Driver 1: +91 9999999997 (mock OTP: 123456)");
console.log("- Driver 2: +91 9999999998 (mock OTP: 123456)");

// Helper to authenticate request and get AuthUser context
async function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw unauthorized("Missing or invalid authorization header");
  }
  const token = authHeader.substring(7);
  const payload = await verifyJwt(token, JWT_SECRET);
  return {
    id: payload.sub,
    role: payload.role as any,
    phone: payload.phone,
  };
}

// Router handler mapping URLs to services
async function routeRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  console.log(`[API-Request] ${req.method} ${path}`);

  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    // STATIC FILES
    if (path === "/" || path === "/index.html") {
      try {
        const html = await Deno.readTextFile("./index.html");
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      } catch (err) {
        return new Response(`index.html not found: ${err.message}`, { status: 404 });
      }
    }
    if (path === "/customer.html") {
      try {
        const html = await Deno.readTextFile("./customer.html");
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      } catch (err) {
        return new Response(`customer.html not found: ${err.message}`, { status: 404 });
      }
    }
    if (path === "/driver.html") {
      try {
        const html = await Deno.readTextFile("./driver.html");
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      } catch (err) {
        return new Response(`driver.html not found: ${err.message}`, { status: 404 });
      }
    }
    if (path === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // PUBLIC ENDPOINTS
    if (path === "/functions/v1/health") {
      return ok({ status: "healthy", time: new Date().toISOString() }, 200, req);
    }

    if (path === "/functions/v1/firebase-config") {
      return ok({
        apiKey: Deno.env.get("FIREBASE_API_KEY") || null,
        authDomain: Deno.env.get("FIREBASE_AUTH_DOMAIN") || null,
        projectId: Deno.env.get("FIREBASE_PROJECT_ID") || null,
        storageBucket: Deno.env.get("FIREBASE_STORAGE_BUCKET") || null,
        messagingSenderId: Deno.env.get("FIREBASE_MESSAGING_SENDER_ID") || null,
        appId: Deno.env.get("FIREBASE_APP_ID") || null,
      }, 200, req);
    }

    if (path === "/functions/v1/auth-session") {
      const body = await req.json().catch(() => ({}));
      const result = await createSession({
        db,
        verifyIdToken: verifyFirebaseIdToken,
        jwtSecret: JWT_SECRET,
        expireMinutes: EXPIRE_MINUTES,
      }, body);
      return ok(result, 200, req);
    }

    // PROTECTED ENDPOINTS
    const authUser = await authenticate(req);

    if (path === "/functions/v1/auth-me") {
      const result = await me(db, authUser);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/auth-refresh") {
      const result = await refreshSession({
        db,
        verifyIdToken: verifyFirebaseIdToken,
        jwtSecret: JWT_SECRET,
        expireMinutes: EXPIRE_MINUTES,
      }, authUser);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/auth-logout") {
      const result = await logout(db, authUser);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/users-fcm-token") {
      const body = await req.json().catch(() => ({}));
      const result = await saveFcmToken(db, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/users-profile") {
      if (req.method !== "POST" && req.method !== "PATCH") throw badRequest("POST/PATCH required");
      const body = await req.json().catch(() => ({}));
      const result = await updateUserProfile(db, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/drivers-nearby") {
      const q = {
        latitude: url.searchParams.get("latitude"),
        longitude: url.searchParams.get("longitude"),
        radiusKm: url.searchParams.get("radiusKm"),
        serviceType: url.searchParams.get("serviceType"),
        dropLatitude: url.searchParams.get("dropLatitude"),
        dropLongitude: url.searchParams.get("dropLongitude"),
      };
      const result = await nearbyDrivers(db, q);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/drivers-profile") {
      if (req.method !== "PATCH") throw badRequest("PATCH required");
      const body = await req.json().catch(() => ({}));
      const result = await upsertProfile(db, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/drivers-availability") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await setAvailability(db, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/drivers-location") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await updateLocation(db, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/drivers-earnings") {
      const result = await earnings(db, authUser);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-create") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await createBooking(db, mockNotifier, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-get") {
      const bookingId = url.searchParams.get("bookingId");
      const result = await getBooking(db, authUser, bookingId ?? undefined);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-history") {
      const result = await bookingHistory(db, authUser);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-accept") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await acceptBooking(db, mockNotifier, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-decline") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await declineBooking(db, mockNotifier, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-cancel") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await cancelBooking(db, mockNotifier, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-arrived") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await markArrived(db, mockNotifier, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-start") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await startTrip(db, mockNotifier, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/bookings-complete") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await completeTrip(db, mockNotifier, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/payments-mark-cod-collected") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await markCodCollected(db, mockNotifier, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/payments-get-by-booking") {
      const bookingId = url.searchParams.get("bookingId");
      const result = await getPaymentByBooking(db, authUser, bookingId);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/reviews-create") {
      if (req.method !== "POST") throw badRequest("POST required");
      const body = await req.json().catch(() => ({}));
      const result = await createReview(db, authUser, body);
      return ok(result, 200, req);
    }

    if (path === "/functions/v1/reviews-by-driver") {
      const driverId = url.searchParams.get("driverId");
      const result = await reviewsByDriver(db, driverId);
      return ok(result, 200, req);
    }

    throw new ApiError(404, "NOT_FOUND", `Endpoint ${path} not found`);

  } catch (err) {
    console.error(`[API-Error] ${path} :`, err);
    return fail(err, req);
  }
}

// Start serving on port 54321
const port = 54321;
Deno.serve({ port }, routeRequest);
console.log(`Mock Supabase backend server listening on http://127.0.0.1:${port}`);
