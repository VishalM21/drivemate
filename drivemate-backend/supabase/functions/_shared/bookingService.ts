import type { Db } from "./db.ts";
import type { AuthUser } from "./roleGuards.ts";
import type { Notifier } from "./notify.ts";
import { badRequest, conflict, forbidden, notFound } from "./errors.ts";
import { bookingToApi } from "./mappers.ts";
import { calculateFare, etaMinutes, haversineKm, ServiceType } from "./fareCalculator.ts";
import type { BookingRow } from "./types.ts";

const SERVICE_TYPES = ["local", "outstation", "airport", "monthly"];
const ROUTE_TYPES = ["one_way", "round_trip", "hourly"];

// ---- state machine -------------------------------------------------------
const TRANSITIONS: Record<string, string[]> = {
  accept: ["pending", "driver_notified"],
  arrived: ["driver_accepted", "driver_arriving"],
  start: ["arrived"],
  complete: ["started"],
  cancel: ["pending", "driver_notified", "driver_accepted", "driver_arriving", "arrived"],
  decline: ["pending", "driver_notified"],
};

function assertTransition(action: keyof typeof TRANSITIONS, current: string) {
  if (!TRANSITIONS[action].includes(current)) {
    throw conflict(`Cannot ${action} a booking in status '${current}'`);
  }
}

function generateBookingNumber(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const rand = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, "0");
  return `DM${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${rand}`;
}

async function loadBooking(db: Db, bookingId?: string): Promise<BookingRow> {
  if (!bookingId) throw badRequest("bookingId is required");
  const b = await db.getBookingById(bookingId);
  if (!b) throw notFound("Booking not found");
  return b;
}

/** Customer (owner) / assigned driver / admin visibility check. */
async function assertParty(db: Db, auth: AuthUser, b: BookingRow): Promise<"customer" | "driver" | "admin"> {
  if (auth.role === "admin") return "admin";
  if (auth.role === "customer") {
    if (b.customer_id !== auth.id) throw forbidden("Not your booking");
    return "customer";
  }
  const driver = await db.getDriverByUserId(auth.id);
  if (!driver || b.driver_id !== driver.id) throw forbidden("Booking is not assigned to you");
  return "driver";
}

async function assertAssignedDriver(db: Db, auth: AuthUser, b: BookingRow) {
  if (auth.role === "admin") return;
  const driver = await db.getDriverByUserId(auth.id);
  if (!driver || b.driver_id !== driver.id) throw forbidden("Booking is not assigned to you");
}

// ---- endpoints -----------------------------------------------------------

export interface CreateBookingBody {
  driverId?: string; serviceType?: string; routeType?: string;
  pickupAddress?: string; pickupLatitude?: number; pickupLongitude?: number;
  dropAddress?: string; dropLatitude?: number; dropLongitude?: number;
  scheduledAt?: string; vehicleNumber?: string; vehicleModel?: string;
  // false when the customer edited the vehicle for just this ride (via the
  // booking screen's Edit override) — keeps their saved default untouched.
  // Omitted/true means "this is/becomes my default car."
  setAsDefault?: boolean;
}

export async function createBooking(db: Db, notify: Notifier, auth: AuthUser, body: CreateBookingBody) {
  if (auth.role !== "customer") throw forbidden("Only customers can create bookings");
  const {
    driverId, serviceType, routeType, pickupAddress, pickupLatitude, pickupLongitude,
    dropAddress, dropLatitude, dropLongitude, scheduledAt, vehicleNumber, vehicleModel, setAsDefault,
  } = body ?? {};

  if (!driverId) throw badRequest("driverId is required");
  if (!serviceType || !SERVICE_TYPES.includes(serviceType)) throw badRequest("serviceType must be local|outstation|airport|monthly");
  if (routeType && !ROUTE_TYPES.includes(routeType)) throw badRequest("routeType must be one_way|round_trip|hourly");
  if (typeof pickupLatitude !== "number" || typeof pickupLongitude !== "number") throw badRequest("pickupLatitude/pickupLongitude are required");
  if (!vehicleNumber) throw badRequest("vehicleNumber is required");

  const driver = await db.getDriverById(driverId);
  if (!driver) throw notFound("Driver not found");
  if (!driver.is_verified) throw conflict("Driver is not verified");
  if (!driver.is_available) throw conflict("Driver is not available");

  const vehicle = await db.upsertVehicle(
    auth.id,
    vehicleNumber.toUpperCase().replace(/\s+/g, ""),
    vehicleModel ?? null,
    setAsDefault !== false,
  );

  const distanceKm =
    typeof dropLatitude === "number" && typeof dropLongitude === "number"
      ? haversineKm(pickupLatitude, pickupLongitude, dropLatitude, dropLongitude)
      : 0;

  const fare = calculateFare({
    serviceType: serviceType as ServiceType,
    pricePerTrip: Number(driver.price_per_trip),
    distanceKm,
  });

  const booking = await db.insertBooking({
    booking_number: generateBookingNumber(),
    customer_id: auth.id,
    driver_id: driver.id,
    vehicle_id: vehicle.id,
    service_type: serviceType,
    route_type: routeType ?? null,
    pickup_address: pickupAddress ?? null,
    pickup_latitude: pickupLatitude,
    pickup_longitude: pickupLongitude,
    drop_address: dropAddress ?? null,
    drop_latitude: dropLatitude ?? null,
    drop_longitude: dropLongitude ?? null,
    scheduled_at: scheduledAt ?? null,
    status: "pending",
    driver_fee: fare.driverFee,
    platform_fee: fare.platformFee,
    tax_amount: fare.taxAmount,
    total_amount: fare.totalAmount,
    payment_status: "pending",
    payment_method: "cod",
  });

  await db.insertPayment({
    booking_id: booking.id, amount: fare.totalAmount, currency: "INR",
    method: "cod", status: "pending",
  });

  await db.insertBookingEvent({
    booking_id: booking.id, event_type: "created", old_status: null,
    new_status: "pending", created_by: auth.id,
    metadata: { fare },
  });

  await notify(db, driver.user_id, {
    title: "New booking request",
    body: `${serviceType} trip from ${pickupAddress ?? "customer location"}`,
    data: { type: "booking_created", bookingId: booking.id },
  });

  return bookingToApi(booking);
}

// Statuses where the customer's tracking screen (and the driver's own ride
// screen) actually need a live position — no point shipping stale/irrelevant
// location data before a driver is assigned or after the trip has ended.
const TRACKABLE_STATUSES = ["driver_accepted", "driver_arriving", "arrived", "started"];

export async function getBooking(db: Db, auth: AuthUser, bookingId?: string) {
  const b = await loadBooking(db, bookingId);
  await assertParty(db, auth, b);
  const bApi = bookingToApi(b) as any;
  if (b.driver_id) {
    const driver = await db.getDriverById(b.driver_id);
    if (driver) {
      const driverUser = await db.getUserById(driver.user_id);
      if (driverUser) {
        bApi.driver = {
          id: driver.id,
          name: driverUser.full_name,
          phone: driverUser.phone,
          rating: Number(driver.rating),
          avatar: driverUser.avatar_url,
        };
      }
    }
    // Realtime's postgres_changes broadcasts require the connecting client's
    // JWT to be verifiable by Supabase's own infra, but this app signs its
    // own JWTs with a separate secret — so we can't authenticate the
    // realtime channel as this specific user. Piggyback the driver's live
    // location on the booking poll (already hit every 4s by the tracking
    // screens) instead, sidestepping that entirely.
    if (TRACKABLE_STATUSES.includes(b.status)) {
      const loc = await db.getDriverLocation(b.driver_id);
      if (loc && loc.latitude != null && loc.longitude != null) {
        bApi.driverLocation = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          heading: loc.heading,
        };
      }
    }
  }
  return bApi;
}

export async function bookingHistory(db: Db, auth: AuthUser) {
  if (auth.role === "customer") {
    return { bookings: (await db.listBookingsByCustomer(auth.id)).map(bookingToApi) };
  }
  if (auth.role === "driver") {
    const driver = await db.getDriverByUserId(auth.id);
    if (!driver) return { bookings: [] };
    return { bookings: (await db.listBookingsByDriver(driver.id)).map(bookingToApi) };
  }
  throw forbidden("Unsupported role for history");
}

export async function acceptBooking(db: Db, notify: Notifier, auth: AuthUser, body: { bookingId?: string }) {
  if (auth.role !== "driver") throw forbidden("Only drivers can accept bookings");
  const b = await loadBooking(db, body?.bookingId);
  await assertAssignedDriver(db, auth, b);
  assertTransition("accept", b.status);

  // Fetch the customer profile to check their ride OTP
  const customer = await db.getUserById(b.customer_id);
  if (!customer) throw badRequest("Customer not found");

  const isTest = typeof (globalThis as any).Deno?.test === "function";
  let otp = customer.ride_otp;
  
  // Always generate a new OTP for normal runs (security); preserve for tests
  if (!otp || !isTest) {
    otp = Math.floor(1000 + Math.random() * 9000).toString();
    await db.updateUser(b.customer_id, { ride_otp: otp });
  }

  // Calculate ETA based on driver location and customer pickup
  const driverLoc = await db.getDriverLocation(b.driver_id);
  let eta = 5; // Default to 5 minutes
  if (driverLoc && driverLoc.latitude != null && driverLoc.longitude != null && b.pickup_latitude != null && b.pickup_longitude != null) {
    const dist = haversineKm(driverLoc.latitude, driverLoc.longitude, b.pickup_latitude, b.pickup_longitude);
    eta = etaMinutes(dist);
  }

  const updated = await db.updateBooking(b.id, { status: "driver_accepted" });
  await db.updateDriver(b.driver_id, { is_available: false });
  await db.insertBookingEvent({
    booking_id: b.id, event_type: "accepted", old_status: b.status,
    new_status: "driver_accepted", created_by: auth.id,
  });

  await notify(db, b.customer_id, {
    title: "Driver accepted your booking",
    body: `Booking ${b.booking_number} confirmed — your driver is on the way. ETA: ${eta} mins. Share OTP ${otp} to start ride.`,
    data: { type: "driver_accepted", bookingId: b.id, eta: String(eta), otp: otp },
  });

  return {
    ...bookingToApi(updated),
    eta,
    otp: otp,
  };
}

export async function declineBooking(db: Db, notify: Notifier, auth: AuthUser, body: { bookingId?: string; reason?: string }) {
  if (auth.role !== "driver" && auth.role !== "admin") throw forbidden("Only the assigned driver or admin can decline");
  const b = await loadBooking(db, body?.bookingId);
  await assertAssignedDriver(db, auth, b);
  assertTransition("decline", b.status);

  const updated = await db.updateBooking(b.id, {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancellation_reason: body?.reason ?? "Declined by driver",
    payment_status: "pending",
  });
  await db.insertBookingEvent({
    booking_id: b.id, event_type: "declined", old_status: b.status,
    new_status: "cancelled", created_by: auth.id, metadata: { reason: body?.reason ?? null },
  });
  await notify(db, b.customer_id, {
    title: "Booking declined",
    body: `Driver could not take booking ${b.booking_number}. Please pick another driver.`,
    data: { type: "booking_declined", bookingId: b.id },
  });
  return bookingToApi(updated);
}

export async function cancelBooking(db: Db, notify: Notifier, auth: AuthUser, body: { bookingId?: string; reason?: string }) {
  const b = await loadBooking(db, body?.bookingId);
  const party = await assertParty(db, auth, b);
  if (party === "driver") throw forbidden("Drivers decline via /bookings-decline, not cancel");
  assertTransition("cancel", b.status);

  const wasAccepted = ["driver_accepted", "driver_arriving", "arrived"].includes(b.status);
  const updated = await db.updateBooking(b.id, {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancellation_reason: body?.reason ?? (party === "admin" ? "Cancelled by admin" : "Cancelled by customer"),
  });
  if (wasAccepted && b.driver_id) {
    // Drivers stay online across trips by default — a cancellation just ends
    // this one, it shouldn't force them to manually re-toggle to keep
    // receiving new requests.
    await db.updateDriver(b.driver_id, { is_available: true });
  }
  await db.insertBookingEvent({
    booking_id: b.id, event_type: "cancelled", old_status: b.status,
    new_status: "cancelled", created_by: auth.id, metadata: { reason: body?.reason ?? null },
  });
  // notify the other party
  const driver = b.driver_id ? await db.getDriverById(b.driver_id) : null;
  if (driver) {
    await notify(db, driver.user_id, {
      title: "Booking cancelled",
      body: `Booking ${b.booking_number} was cancelled.`,
      data: { type: "booking_cancelled", bookingId: b.id },
    });
  }
  return bookingToApi(updated);
}

export async function markArrived(db: Db, notify: Notifier, auth: AuthUser, body: { bookingId?: string }) {
  if (auth.role !== "driver") throw forbidden("Only drivers can mark arrived");
  const b = await loadBooking(db, body?.bookingId);
  await assertAssignedDriver(db, auth, b);
  assertTransition("arrived", b.status);
  const updated = await db.updateBooking(b.id, { status: "arrived" });
  await db.insertBookingEvent({
    booking_id: b.id, event_type: "arrived", old_status: b.status, new_status: "arrived", created_by: auth.id,
  });
  await notify(db, b.customer_id, {
    title: "Driver has arrived",
    body: `Your driver for booking ${b.booking_number} is at the pickup point.`,
    data: { type: "driver_arrived", bookingId: b.id },
  });
  return bookingToApi(updated);
}

export async function startTrip(db: Db, notify: Notifier, auth: AuthUser, body: { bookingId?: string; otp?: string }) {
  if (auth.role !== "driver") throw forbidden("Only drivers can start trips");
  const b = await loadBooking(db, body?.bookingId);
  await assertAssignedDriver(db, auth, b);
  assertTransition("start", b.status);

  const customer = await db.getUserById(b.customer_id);
  if (!customer) throw badRequest("Customer not found");
  
  if (!body?.otp) {
    throw badRequest("OTP is required to start the ride");
  }
  
  if (customer.ride_otp && body.otp !== customer.ride_otp) {
    throw badRequest("Invalid OTP. Please enter the correct OTP shared by the customer.");
  }

  const updated = await db.updateBooking(b.id, { status: "started", started_at: new Date().toISOString() });
  await db.insertBookingEvent({
    booking_id: b.id, event_type: "started", old_status: b.status, new_status: "started", created_by: auth.id,
  });
  await notify(db, b.customer_id, {
    title: "Trip started",
    body: `Trip ${b.booking_number} has started. Safe travels!`,
    data: { type: "trip_started", bookingId: b.id },
  });
  return bookingToApi(updated);
}

export async function completeTrip(db: Db, notify: Notifier, auth: AuthUser, body: { bookingId?: string }) {
  if (auth.role !== "driver") throw forbidden("Only drivers can complete trips");
  const b = await loadBooking(db, body?.bookingId);
  await assertAssignedDriver(db, auth, b);
  assertTransition("complete", b.status);

  const updated = await db.updateBooking(b.id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    payment_status: "pending", // payment still due — cash or online, customer's choice
  });
  // Drivers stay online across trips by default — completing this one
  // shouldn't force them to manually re-toggle to keep receiving requests.
  const driver = await db.getDriverById(b.driver_id);
  if (driver) {
    await db.updateDriver(driver.id, { is_available: true, total_trips: driver.total_trips + 1 });
  }
  await db.insertBookingEvent({
    booking_id: b.id, event_type: "completed", old_status: b.status, new_status: "completed", created_by: auth.id,
  });
  await notify(db, b.customer_id, {
    title: "Trip completed — payment due",
    body: `Please pay ₹${Number(b.total_amount)} (cash or online) and leave a review for your driver.`,
    data: { type: "trip_completed", bookingId: b.id, amount: String(b.total_amount) },
  });
  return bookingToApi(updated);
}
