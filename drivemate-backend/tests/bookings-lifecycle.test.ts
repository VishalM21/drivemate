import { assert, assertEquals, assertRejects } from "./_mocks/assert.ts";
import { makeWorld, asAuth } from "./_mocks/fixtures.ts";
import { mockNotifier } from "./_mocks/memoryDb.ts";
import {
  createBooking, acceptBooking, markArrived, startTrip, completeTrip, cancelBooking, declineBooking,
} from "../supabase/functions/_shared/bookingService.ts";
import {
  AIRPORT_SURCHARGE, PLATFORM_FEE_RATE, TAX_RATE, calculateFare,
} from "../supabase/functions/_shared/fareCalculator.ts";
import { ApiError } from "../supabase/functions/_shared/errors.ts";

const body = (driverId: string, over: any = {}) => ({
  driverId, serviceType: "local", routeType: "hourly",
  pickupAddress: "Mall Road", pickupLatitude: 26.4499, pickupLongitude: 80.3319,
  dropAddress: "Airport", dropLatitude: 26.47, dropLongitude: 80.35,
  scheduledAt: new Date().toISOString(), vehicleNumber: "UP78AB1234", vehicleModel: "Swift", ...over,
});

Deno.test("customer creates booking: fare math, payment row, event, vehicle upsert, driver push", async () => {
  const w = makeWorld();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));

  // fare: local => driverFee = 400, platform 10%, tax 18% of platform
  assertEquals(b.driverFee, 400);
  assertEquals(b.platformFee, 400 * PLATFORM_FEE_RATE);
  assertEquals(b.taxAmount, Math.round(400 * PLATFORM_FEE_RATE * TAX_RATE * 100) / 100);
  assertEquals(b.totalAmount, 400 + 40 + 7.2);
  assertEquals(b.status, "pending");
  assertEquals(b.paymentStatus, "pending");
  assertEquals(b.paymentMethod, "cod");
  assert(b.bookingNumber.startsWith("DM"));

  const payment = await w.db.getPaymentByBookingId(b.id);
  assertEquals(payment?.status, "pending");
  assertEquals(Number(payment?.amount), b.totalAmount);

  assertEquals(w.db.vehicles.length, 1);
  assertEquals(w.db.vehicles[0].vehicle_number, "UP78AB1234");
  assertEquals(w.db.events.filter((e) => e.booking_id === b.id && e.event_type === "created").length, 1);
  assertEquals(w.db.notifications.filter((n) => n.user_id === w.driverUser.id).length, 1);

  // second booking with the same plate does not duplicate the vehicle
  await w.db.updateDriver(w.driver.id, { is_available: true });
  await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  assertEquals(w.db.vehicles.length, 1);
});

Deno.test("airport fare adds surcharge; fare calculator branches", () => {
  const airport = calculateFare({ serviceType: "airport", pricePerTrip: 400 });
  assertEquals(airport.driverFee, 400 + AIRPORT_SURCHARGE);
  const outstation = calculateFare({ serviceType: "outstation", pricePerTrip: 400, distanceKm: 100 });
  assertEquals(outstation.driverFee, 400 + 100 * 12);
  const monthly = calculateFare({ serviceType: "monthly", pricePerTrip: 400 });
  assertEquals(monthly.driverFee, 15000);
});

Deno.test("booking creation guards: role, driver validity", async () => {
  const w = makeWorld();
  await assertRejects(() => createBooking(w.db, mockNotifier, asAuth(w.driverUser), body(w.driver.id)), ApiError, "Only customers");
  await w.db.updateDriver(w.driver.id, { is_verified: false });
  await assertRejects(() => createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id)), ApiError, "not verified");
  await w.db.updateDriver(w.driver.id, { is_verified: true, is_available: false });
  await assertRejects(() => createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id)), ApiError, "not available");
  await assertRejects(() => createBooking(w.db, mockNotifier, asAuth(w.customer), body("00000000-0000-4000-8000-999999999999")), ApiError, "not found");
});

Deno.test("full happy-path lifecycle: pending → accepted → arrived → started → completed", async () => {
  const w = makeWorld();
  const auth = { customer: asAuth(w.customer), driver: asAuth(w.driverUser) };
  const b = await createBooking(w.db, mockNotifier, auth.customer, body(w.driver.id));

  const accepted = await acceptBooking(w.db, mockNotifier, auth.driver, { bookingId: b.id });
  assertEquals(accepted.status, "driver_accepted");
  assertEquals((await w.db.getDriverById(w.driver.id))?.is_available, false); // driver locked

  const arrived = await markArrived(w.db, mockNotifier, auth.driver, { bookingId: b.id });
  assertEquals(arrived.status, "arrived");

  // Reject starting trip without OTP
  await assertRejects(() => startTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id }), ApiError, "OTP is required");
  // Reject starting trip with invalid OTP
  await assertRejects(() => startTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id, otp: "9999" }), ApiError, "Invalid OTP");

  const started = await startTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id, otp: "1234" });
  assertEquals(started.status, "started");
  assert(started.startedAt);

  const done = await completeTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id });
  assertEquals(done.status, "completed");
  assert(done.completedAt);
  assertEquals(done.paymentStatus, "pending");

  const driver = await w.db.getDriverById(w.driver.id);
  assertEquals(driver?.is_available, true);   // freed
  assertEquals(driver?.total_trips, 1);       // incremented

  // customer got accepted/arrived/started/completed pushes
  const custNotifs = w.db.notifications.filter((n) => n.user_id === w.customer.id);
  assertEquals(custNotifs.length, 4);
});

Deno.test("state machine rejects invalid transitions", async () => {
  const w = makeWorld();
  const auth = { customer: asAuth(w.customer), driver: asAuth(w.driverUser) };
  const b = await createBooking(w.db, mockNotifier, auth.customer, body(w.driver.id));

  // cannot start or complete before the right state
  await assertRejects(() => startTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id, otp: "1234" }), ApiError, "Cannot start");
  await assertRejects(() => completeTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id }), ApiError, "Cannot complete");
  await assertRejects(() => markArrived(w.db, mockNotifier, auth.driver, { bookingId: b.id }), ApiError, "Cannot arrived");

  await acceptBooking(w.db, mockNotifier, auth.driver, { bookingId: b.id });
  // cannot accept twice
  await assertRejects(() => acceptBooking(w.db, mockNotifier, auth.driver, { bookingId: b.id }), ApiError, "Cannot accept");
  // cannot decline after accepting
  await assertRejects(() => declineBooking(w.db, mockNotifier, auth.driver, { bookingId: b.id }), ApiError, "Cannot decline");

  await markArrived(w.db, mockNotifier, auth.driver, { bookingId: b.id });
  await startTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id, otp: "1234" });
  // cannot cancel a started trip
  await assertRejects(() => cancelBooking(w.db, mockNotifier, auth.customer, { bookingId: b.id }), ApiError, "Cannot cancel");
  await completeTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id });
  // cannot complete twice
  await assertRejects(() => completeTrip(w.db, mockNotifier, auth.driver, { bookingId: b.id }), ApiError, "Cannot complete");
});

Deno.test("cancel branch: customer cancels after accept — driver freed, driver notified, reason stored", async () => {
  const w = makeWorld();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  await acceptBooking(w.db, mockNotifier, asAuth(w.driverUser), { bookingId: b.id });

  const cancelled = await cancelBooking(w.db, mockNotifier, asAuth(w.customer), { bookingId: b.id, reason: "Plans changed" });
  assertEquals(cancelled.status, "cancelled");
  assertEquals(cancelled.cancellationReason, "Plans changed");
  assert(cancelled.cancelledAt);
  assertEquals((await w.db.getDriverById(w.driver.id))?.is_available, true);
  assert(w.db.notifications.some((n) => n.user_id === w.driverUser.id && n.title === "Booking cancelled"));
});

Deno.test("decline branch: driver declines pending booking, customer notified", async () => {
  const w = makeWorld();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  const declined = await declineBooking(w.db, mockNotifier, asAuth(w.driverUser), { bookingId: b.id, reason: "Too far" });
  assertEquals(declined.status, "cancelled");
  assertEquals(declined.cancellationReason, "Too far");
  assert(w.db.notifications.some((n) => n.user_id === w.customer.id && n.title === "Booking declined"));
});

Deno.test("admin can cancel any booking", async () => {
  const w = makeWorld();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  const cancelled = await cancelBooking(w.db, mockNotifier, asAuth(w.admin), { bookingId: b.id });
  assertEquals(cancelled.status, "cancelled");
  assertEquals(cancelled.cancellationReason, "Cancelled by admin");
});
