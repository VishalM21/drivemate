import { assert, assertEquals, assertRejects } from "./_mocks/assert.ts";
import { makeWorld, asAuth } from "./_mocks/fixtures.ts";
import { updateLocation, setAvailability } from "../supabase/functions/_shared/driverService.ts";
import { ApiError } from "../supabase/functions/_shared/errors.ts";

Deno.test("driver location update persists all telemetry fields", async () => {
  const w = makeWorld();
  const res = await updateLocation(w.db, asAuth(w.driverUser), {
    latitude: 26.5, longitude: 80.4, heading: 92.5, speed: 11.2, accuracy: 4.8, isOnline: true,
  });
  assertEquals(res.latitude, 26.5);
  assertEquals(res.longitude, 80.4);
  assertEquals(res.heading, 92.5);
  assertEquals(res.speed, 11.2);
  assertEquals(res.accuracy, 4.8);
  assertEquals(res.isOnline, true);

  const stored = await w.db.getDriverLocation(w.driver.id);
  assertEquals(stored?.latitude, 26.5);
  // geo_point is synced by the Postgres trigger in production; here we assert
  // the row upsert carries the lat/lng the trigger derives geo_point from.
  assert(stored && new Date(stored.updated_at).getTime() > Date.now() - 5000);
});

Deno.test("driver location rejects invalid input and non-driver profiles", async () => {
  const w = makeWorld();
  await assertRejects(() => updateLocation(w.db, asAuth(w.driverUser), { latitude: 200, longitude: 80 } as any), ApiError, "range");
  await assertRejects(() => updateLocation(w.db, asAuth(w.driverUser), {} as any), ApiError, "required");
  // customer has no driver profile
  await assertRejects(() => updateLocation(w.db, asAuth(w.customer), { latitude: 26, longitude: 80 }), ApiError, "not found");
});

Deno.test("availability toggle blocked for unverified drivers", async () => {
  const w = makeWorld();
  await w.db.updateDriver(w.driver.id, { is_verified: false });
  await assertRejects(() => setAvailability(w.db, asAuth(w.driverUser), { isAvailable: true }), ApiError, "not verified");
  const off = await setAvailability(w.db, asAuth(w.driverUser), { isAvailable: false });
  assertEquals(off.isAvailable, false);
});
