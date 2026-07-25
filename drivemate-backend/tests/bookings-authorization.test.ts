import { assertEquals, assertRejects } from "./_mocks/assert.ts";
import { makeWorld, asAuth } from "./_mocks/fixtures.ts";
import { mockNotifier } from "./_mocks/memoryDb.ts";
import { createBooking, acceptBooking, getBooking, bookingHistory } from "../supabase/functions/_shared/bookingService.ts";
import { ApiError } from "../supabase/functions/_shared/errors.ts";

const body = (driverId: string) => ({
  driverId, serviceType: "local", routeType: "one_way",
  pickupAddress: "A", pickupLatitude: 26.44, pickupLongitude: 80.33,
  vehicleNumber: "UP78ZZ0001",
});

Deno.test("a driver cannot accept a booking assigned to a different driver (403)", async () => {
  const w = makeWorld();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  const err = await assertRejects(
    () => acceptBooking(w.db, mockNotifier, asAuth(w.otherDriverUser), { bookingId: b.id }),
    ApiError, "not assigned to you",
  );
  assertEquals((err as ApiError).status, 403);
});

Deno.test("a customer cannot access another customer's booking (403)", async () => {
  const w = makeWorld();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  const err = await assertRejects(
    () => getBooking(w.db, asAuth(w.otherCustomer), b.id),
    ApiError, "Not your booking",
  );
  assertEquals((err as ApiError).status, 403);
});

Deno.test("assigned driver and admin can read the booking; history is scoped per role", async () => {
  const w = makeWorld();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));

  assertEquals((await getBooking(w.db, asAuth(w.driverUser), b.id)).id, b.id);
  assertEquals((await getBooking(w.db, asAuth(w.admin), b.id)).id, b.id);
  assertEquals((await getBooking(w.db, asAuth(w.customer), b.id)).id, b.id);

  assertEquals((await bookingHistory(w.db, asAuth(w.customer))).bookings.length, 1);
  assertEquals((await bookingHistory(w.db, asAuth(w.otherCustomer))).bookings.length, 0);
  assertEquals((await bookingHistory(w.db, asAuth(w.driverUser))).bookings.length, 1);
  assertEquals((await bookingHistory(w.db, asAuth(w.otherDriverUser))).bookings.length, 0);
});
