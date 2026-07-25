import { assert, assertEquals, assertRejects } from "./_mocks/assert.ts";
import { makeWorld, asAuth } from "./_mocks/fixtures.ts";
import { mockNotifier } from "./_mocks/memoryDb.ts";
import { createBooking, acceptBooking, markArrived, startTrip, completeTrip } from "../supabase/functions/_shared/bookingService.ts";
import { markCodCollected, getPaymentByBooking } from "../supabase/functions/_shared/paymentService.ts";
import { ApiError } from "../supabase/functions/_shared/errors.ts";

const body = (driverId: string) => ({
  driverId, serviceType: "local",
  pickupLatitude: 26.44, pickupLongitude: 80.33, vehicleNumber: "UP78CC0007",
});

async function toCompleted(w: ReturnType<typeof makeWorld>) {
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  const drv = asAuth(w.driverUser);
  await acceptBooking(w.db, mockNotifier, drv, { bookingId: b.id });
  await markArrived(w.db, mockNotifier, drv, { bookingId: b.id });
  await startTrip(w.db, mockNotifier, drv, { bookingId: b.id, otp: "1234" });
  await completeTrip(w.db, mockNotifier, drv, { bookingId: b.id });
  return b;
}

Deno.test("COD cannot be collected before completion", async () => {
  const w = makeWorld();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  await assertRejects(
    () => markCodCollected(w.db, mockNotifier, asAuth(w.driverUser), { bookingId: b.id }),
    ApiError, "after the trip is completed",
  );
});

Deno.test("only the assigned driver or admin can mark COD collected", async () => {
  const w = makeWorld();
  const b = await toCompleted(w);
  await assertRejects(() => markCodCollected(w.db, mockNotifier, asAuth(w.otherDriverUser), { bookingId: b.id }), ApiError, "not assigned");
  await assertRejects(() => markCodCollected(w.db, mockNotifier, asAuth(w.customer), { bookingId: b.id }), ApiError, "Only the assigned driver or admin");

  const paid = await markCodCollected(w.db, mockNotifier, asAuth(w.driverUser), { bookingId: b.id });
  assertEquals(paid.status, "paid");
  assert(paid.collectedAt);
  assertEquals(paid.collectedBy, w.driverUser.id);
  assertEquals((await w.db.getBookingById(b.id))?.payment_status, "paid");
  // double collection blocked
  await assertRejects(() => markCodCollected(w.db, mockNotifier, asAuth(w.driverUser), { bookingId: b.id }), ApiError, "already settled");
  // customer got the confirmation push
  assert(w.db.notifications.some((n) => n.user_id === w.customer.id && n.title === "Payment received"));
});

Deno.test("admin can also mark COD collected", async () => {
  const w = makeWorld();
  const b = await toCompleted(w);
  const paid = await markCodCollected(w.db, mockNotifier, asAuth(w.admin), { bookingId: b.id });
  assertEquals(paid.status, "paid");
});

Deno.test("payments-get-by-booking: parties only", async () => {
  const w = makeWorld();
  const b = await toCompleted(w);
  assertEquals((await getPaymentByBooking(w.db, asAuth(w.customer), b.id)).bookingId, b.id);
  assertEquals((await getPaymentByBooking(w.db, asAuth(w.driverUser), b.id)).bookingId, b.id);
  assertEquals((await getPaymentByBooking(w.db, asAuth(w.admin), b.id)).bookingId, b.id);
  await assertRejects(() => getPaymentByBooking(w.db, asAuth(w.otherCustomer), b.id), ApiError, "Not your booking");
  await assertRejects(() => getPaymentByBooking(w.db, asAuth(w.otherDriverUser), b.id), ApiError, "not assigned");
});
