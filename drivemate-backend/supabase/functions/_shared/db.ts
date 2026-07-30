// Thin repository interface. Edge functions use SupabaseDb (see supabaseDb.ts);
// tests use an in-memory implementation. Keeping this interface dependency-free
// lets `deno test` run with zero network access.
import type {
  BookingRow, DriverLocationRow, DriverRow, NearbyDriverRow,
  PaymentRow, ReviewRow, UserRow, VehicleRow,
} from "./types.ts";

export interface Db {
  // users
  getUserByFirebaseUid(uid: string): Promise<UserRow | null>;
  getUserByPhone(phone: string): Promise<UserRow | null>;
  getUserById(id: string): Promise<UserRow | null>;
  createUser(u: Partial<UserRow>): Promise<UserRow>;
  updateUser(id: string, patch: Partial<UserRow>): Promise<UserRow>;

  // drivers
  getDriverById(id: string): Promise<DriverRow | null>;
  getDriverByUserId(userId: string): Promise<DriverRow | null>;
  createDriver(d: Partial<DriverRow>): Promise<DriverRow>;
  updateDriver(id: string, patch: Partial<DriverRow>): Promise<DriverRow>;

  // driver locations
  upsertDriverLocation(loc: Partial<DriverLocationRow> & { driver_id: string }): Promise<DriverLocationRow>;
  getDriverLocation(driverId: string): Promise<DriverLocationRow | null>;
  findNearbyDrivers(lat: number, lng: number, radiusKm: number, serviceType: string): Promise<NearbyDriverRow[]>;

  // vehicles
  // isDefault (default true) also clears any other default vehicle for this
  // customer first, so there's ever only one. Pass false for a one-off ride
  // override that shouldn't replace the customer's saved default.
  upsertVehicle(customerId: string, vehicleNumber: string, vehicleModel?: string | null, isDefault?: boolean): Promise<VehicleRow>;
  getDefaultVehicle(customerId: string): Promise<VehicleRow | null>;

  // bookings
  insertBooking(b: Partial<BookingRow>): Promise<BookingRow>;
  getBookingById(id: string): Promise<BookingRow | null>;
  updateBooking(id: string, patch: Partial<BookingRow>): Promise<BookingRow>;
  listBookingsByCustomer(customerId: string): Promise<BookingRow[]>;
  listBookingsByDriver(driverId: string): Promise<BookingRow[]>;
  listCompletedCollectedByDriver(driverId: string): Promise<BookingRow[]>;
  // Demand side of the surge ratio — see dynamicPricing.ts.
  countPendingBookingsNear(lat: number, lng: number, radiusKm: number): Promise<number>;

  // booking events
  insertBookingEvent(e: {
    booking_id: string; event_type: string; old_status?: string | null;
    new_status?: string | null; created_by?: string | null; metadata?: unknown;
  }): Promise<void>;

  // payments
  insertPayment(p: Partial<PaymentRow>): Promise<PaymentRow>;
  getPaymentByBookingId(bookingId: string): Promise<PaymentRow | null>;
  getPaymentByGatewayOrderId(gatewayOrderId: string): Promise<PaymentRow | null>;
  updatePayment(id: string, patch: Partial<PaymentRow>): Promise<PaymentRow>;

  // reviews
  insertReview(r: Partial<ReviewRow>): Promise<ReviewRow>;
  getReviewByBookingId(bookingId: string): Promise<ReviewRow | null>;
  getReviewByBookingAndRole(bookingId: string, reviewerRole: string): Promise<ReviewRow | null>;
  listReviewsByDriver(driverId: string): Promise<ReviewRow[]>;
  listReviewsByCustomer(customerId: string): Promise<ReviewRow[]>;

  // notifications
  insertNotification(n: { user_id: string; title: string; body: string; data?: unknown }): Promise<void>;
}
