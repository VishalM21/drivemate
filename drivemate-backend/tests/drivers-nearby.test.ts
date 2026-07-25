import { assert, assertEquals, assertRejects } from "./_mocks/assert.ts";
import { MemoryDb } from "./_mocks/memoryDb.ts";
import { nearbyDrivers } from "../supabase/functions/_shared/driverService.ts";
import { ApiError } from "../supabase/functions/_shared/errors.ts";

function setup() {
  const db = new MemoryDb();
  const mk = (name: string, dp: any, lp: any) => {
    const u = db.seedUser({ role: "driver", full_name: name });
    const d = db.seedDriver({ user_id: u.id, ...dp });
    db.seedLocation({ driver_id: d.id, ...lp });
    return d;
  };
  return { db, mk };
}
const q = (over: any = {}) => ({ latitude: "26.4499", longitude: "80.3319", radiusKm: "10", serviceType: "local", ...over });

Deno.test("nearby: filters unverified, unavailable, stale, offline and out-of-radius drivers", async () => {
  const { db, mk } = setup();
  mk("Good Driver", {}, { latitude: 26.455, longitude: 80.335 });
  mk("Unverified", { is_verified: false }, {});
  mk("Unavailable", { is_available: false }, {});
  mk("Stale", {}, { updated_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() });
  mk("Offline", {}, { is_online: false });
  mk("Far Away", {}, { latitude: 28.6, longitude: 77.2 }); // Delhi, ~430km

  const res = await nearbyDrivers(db, q());
  assertEquals(res.drivers.length, 1);
  assertEquals(res.drivers[0].name, "Good Driver");
});

Deno.test("nearby: service type filter and distance ordering, camelCase shape", async () => {
  const { db, mk } = setup();
  mk("Near Local", { service_airport: false }, { latitude: 26.451, longitude: 80.333 });
  mk("Far Airport", { service_airport: true }, { latitude: 26.48, longitude: 80.36 });
  mk("Near Airport", { service_airport: true }, { latitude: 26.452, longitude: 80.334 });

  const airport = await nearbyDrivers(db, q({ serviceType: "airport" }));
  assertEquals(airport.drivers.map((d: any) => d.name), ["Near Airport", "Far Airport"]);

  const d = airport.drivers[0];
  assert(typeof d.pricePerTrip === "number");
  assert(typeof d.distanceKm === "number");
  assert(typeof d.etaMinutes === "number" && d.etaMinutes >= 1);
  assert(d.location && typeof d.location.latitude === "number");
  assertEquals(d.experience, "3 years");
  assertEquals(d.avatar, "NA"); // "Near Airport" initials
  assert(d.isVerified && d.isAvailable);
});

Deno.test("nearby: rejects missing coordinates", async () => {
  const { db } = setup();
  await assertRejects(() => nearbyDrivers(db, { latitude: null, longitude: null }), ApiError, "latitude");
});
