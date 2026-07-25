import { assertEquals, assertRejects } from "./_mocks/assert.ts";
import { makeWorld, asAuth } from "./_mocks/fixtures.ts";
import { mockNotifier } from "./_mocks/memoryDb.ts";
import { createBooking, acceptBooking, markArrived, startTrip, completeTrip } from "../supabase/functions/_shared/bookingService.ts";
import { createReview, reviewsByDriver } from "../supabase/functions/_shared/reviewService.ts";
import { ApiError } from "../supabase/functions/_shared/errors.ts";

const body = (driverId: string) => ({
  driverId, serviceType: "local", pickupLatitude: 26.44, pickupLongitude: 80.33, vehicleNumber: "UP78RV0001",
});

async function completedBooking(w: ReturnType<typeof makeWorld>) {
  await w.db.updateDriver(w.driver.id, { is_available: true });
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  const drv = asAuth(w.driverUser);
  await acceptBooking(w.db, mockNotifier, drv, { bookingId: b.id });
  await markArrived(w.db, mockNotifier, drv, { bookingId: b.id });
  await startTrip(w.db, mockNotifier, drv, { bookingId: b.id, otp: "1234" });
  await completeTrip(w.db, mockNotifier, drv, { bookingId: b.id });
  return b;
}

Deno.test("review rules: completed-only, own-booking-only, rating bounds, one per booking", async () => {
  const w = makeWorld();
  const pending = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  await assertRejects(() => createReview(w.db, asAuth(w.customer), { bookingId: pending.id, rating: 5 }), ApiError, "completed");

  // finish that same booking properly
  const drv = asAuth(w.driverUser);
  await acceptBooking(w.db, mockNotifier, drv, { bookingId: pending.id });
  await markArrived(w.db, mockNotifier, drv, { bookingId: pending.id });
  await startTrip(w.db, mockNotifier, drv, { bookingId: pending.id, otp: "1234" });
  await completeTrip(w.db, mockNotifier, drv, { bookingId: pending.id });

  await assertRejects(() => createReview(w.db, asAuth(w.otherCustomer), { bookingId: pending.id, rating: 5 }), ApiError, "Not your booking");
  await assertRejects(() => createReview(w.db, asAuth(w.customer), { bookingId: pending.id, rating: 0 }), ApiError, "between 1 and 5");
  await assertRejects(() => createReview(w.db, asAuth(w.customer), { bookingId: pending.id, rating: 6 }), ApiError, "between 1 and 5");
  await assertRejects(() => createReview(w.db, asAuth(w.customer), { bookingId: pending.id, rating: 4.5 } as any), ApiError, "integer");

  // Driver can review customer successfully
  const drvReview = await createReview(w.db, asAuth(w.driverUser), { bookingId: pending.id, rating: 4 });
  assertEquals(drvReview.rating, 4);
  await assertRejects(() => createReview(w.db, asAuth(w.driverUser), { bookingId: pending.id, rating: 5 }), ApiError, "already reviewed");

  const r = await createReview(w.db, asAuth(w.customer), { bookingId: pending.id, rating: 5, comment: "Great drive" });
  assertEquals(r.rating, 5);
  await assertRejects(() => createReview(w.db, asAuth(w.customer), { bookingId: pending.id, rating: 4 }), ApiError, "already reviewed");
});

Deno.test("driver rating recalculates as the average after each review", async () => {
  const w = makeWorld();
  const b1 = await completedBooking(w);
  await createReview(w.db, asAuth(w.customer), { bookingId: b1.id, rating: 5 });
  assertEquals((await w.db.getDriverById(w.driver.id))?.rating, 5);

  const b2 = await completedBooking(w);
  await createReview(w.db, asAuth(w.customer), { bookingId: b2.id, rating: 4 });
  assertEquals((await w.db.getDriverById(w.driver.id))?.rating, 4.5);

  const b3 = await completedBooking(w);
  await createReview(w.db, asAuth(w.customer), { bookingId: b3.id, rating: 3 });
  assertEquals((await w.db.getDriverById(w.driver.id))?.rating, 4);

  const list = await reviewsByDriver(w.db, w.driver.id);
  assertEquals(list.count, 3);
  assertEquals(list.rating, 4);
});
