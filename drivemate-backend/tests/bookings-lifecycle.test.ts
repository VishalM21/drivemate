import { assert, assertEquals, assertRejects } from "./_mocks/assert.ts";
import { makeWorld, asAuth } from "./_mocks/fixtures.ts";
import { mockNotifier } from "./_mocks/memoryDb.ts";
import {
  createBooking, acceptBooking, markArrived, startTrip, completeTrip, cancelBooking, declineBooking,
} from "../supabase/functions/_shared/bookingService.ts";
import {
  AIRPORT_SURCHARGE, BASE_FARE, OUTSTATION_BASE_FARE, PER_KM_OUTSTATION_RATE, PER_KM_RATE,
  PLATFORM_FEE_RATE, TAX_RATE, calculateFare, haversineKm,
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

  // fare: platform base rate (no driver-set price anymore) + surge (1x here
  // — no competing demand/supply in this isolated test world), platform 10%,
  // tax 18% of platform.
  const distanceKm = haversineKm(26.4499, 80.3319, 26.47, 80.35);
  const expectedDriverFee = Math.round((BASE_FARE + distanceKm * PER_KM_RATE) * 100) / 100;
  assertEquals(b.driverFee, expectedDriverFee);
  assertEquals(b.surgeMultiplier, 1);
  assertEquals(b.platformFee, Math.round(expectedDriverFee * PLATFORM_FEE_RATE * 100) / 100);
  assertEquals(b.taxAmount, Math.round(b.platformFee * TAX_RATE * 100) / 100);
  assertEquals(b.totalAmount, Math.round((b.driverFee + b.platformFee + b.taxAmount) * 100) / 100);
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
  const airport = calculateFare({ serviceType: "airport", distanceKm: 10 });
  assertEquals(airport.driverFee, BASE_FARE + AIRPORT_SURCHARGE + 10 * PER_KM_RATE);
  const outstation = calculateFare({ serviceType: "outstation", distanceKm: 100 });
  assertEquals(outstation.driverFee, OUTSTATION_BASE_FARE + 100 * PER_KM_OUTSTATION_RATE);
  const monthly = calculateFare({ serviceType: "monthly", distanceKm: 999 });
  assertEquals(monthly.driverFee, 15000);
});

Deno.test("surge multiplier scales the driver fare but not monthly", () => {
  const surged = calculateFare({ serviceType: "local", distanceKm: 10, surgeMultiplier: 1.5 });
  const base = calculateFare({ serviceType: "local", distanceKm: 10 });
  assertEquals(surged.driverFee, Math.round(base.driverFee * 1.5 * 100) / 100);
  const monthlySurged = calculateFare({ serviceType: "monthly", surgeMultiplier: 2 });
  assertEquals(monthlySurged.driverFee, 15000); // monthly is flat, never surged
  // surge multiplier can't go below 1x (no "discount surge")
  const floored = calculateFare({ serviceType: "local", distanceKm: 10, surgeMultiplier: 0.5 });
  assertEquals(floored.driverFee, base.driverFee);
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
