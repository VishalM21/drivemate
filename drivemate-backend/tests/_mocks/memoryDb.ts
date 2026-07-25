// In-memory Db implementation — the "mocked Supabase client" fixture layer.
// Zero network, zero external deps; mirrors the SQL semantics the services rely on.
import type { Db } from "../../supabase/functions/_shared/db.ts";
import type {
  BookingRow, DriverLocationRow, DriverRow, NearbyDriverRow,
  PaymentRow, ReviewRow, UserRow, VehicleRow,
} from "../../supabase/functions/_shared/types.ts";
import { haversineKm } from "../../supabase/functions/_shared/fareCalculator.ts";

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const now = () => new Date().toISOString();

export class MemoryDb implements Db {
  users: UserRow[] = [];
  drivers: DriverRow[] = [];
  locations: DriverLocationRow[] = [];
  vehicles: VehicleRow[] = [];
  bookings: BookingRow[] = [];
  events: any[] = [];
  payments: PaymentRow[] = [];
  reviews: ReviewRow[] = [];
  notifications: any[] = [];

  // ---- fixtures -----------------------------------------------------------
  seedUser(p: Partial<UserRow>): UserRow {
    const role = p.role ?? "customer";
    const u: UserRow = {
      id: uuid(), firebase_uid: p.firebase_uid ?? `fb-${seq}`, phone: p.phone ?? `9${String(seq).padStart(9, "0")}`,
      role, full_name: p.full_name ?? null, email: null, avatar_url: null,
      fcm_token: p.fcm_token ?? "fcm-token", is_active: p.is_active ?? true,
      ride_otp: role === "customer" ? (p.ride_otp ?? "1234") : null,
      dob: p.dob ?? null, car_name: p.car_name ?? null, car_rc_name: p.car_rc_name ?? null,
      rating_as_customer: p.rating_as_customer ?? 0, total_trips_as_customer: p.total_trips_as_customer ?? 0,
      created_at: now(), updated_at: now(),
      ...p,
    } as UserRow;
    this.users.push(u);
    return u;
  }
  seedDriver(p: Partial<DriverRow> & { user_id: string }): DriverRow {
    const d: DriverRow = {
      id: uuid(), rating: 0, total_trips: 0, experience_years: 3, languages: ["Hindi", "English"],
      price_per_trip: 400, is_verified: true, is_available: true,
      service_local: true, service_outstation: false, service_airport: false,
      service_monthly: false, service_night: false, license_number: "LIC-1", email: null,
      created_at: now(), updated_at: now(), ...p,
    } as DriverRow;
    this.drivers.push(d);
    return d;
  }
  seedLocation(p: Partial<DriverLocationRow> & { driver_id: string }): DriverLocationRow {
    const l: DriverLocationRow = {
      id: uuid(), latitude: 26.4499, longitude: 80.3319, heading: null, speed: null, accuracy: null,
      is_online: true, updated_at: now(), ...p,
    } as DriverLocationRow;
    this.locations = this.locations.filter((x) => x.driver_id !== l.driver_id);
    this.locations.push(l);
    return l;
  }

  // ---- Db interface -------------------------------------------------------
  async getUserByFirebaseUid(uid: string) { return this.users.find((u) => u.firebase_uid === uid) ?? null; }
  async getUserByPhone(phone: string) { return this.users.find((u) => u.phone === phone) ?? null; }
  async getUserById(id: string) { return this.users.find((u) => u.id === id) ?? null; }
  async createUser(u: Partial<UserRow>) { return this.seedUser(u); }
  async updateUser(id: string, patch: Partial<UserRow>) {
    const u = this.users.find((x) => x.id === id)!;
    Object.assign(u, patch, { updated_at: now() });
    return u;
  }

  async getDriverById(id: string) { return this.drivers.find((d) => d.id === id) ?? null; }
  async getDriverByUserId(userId: string) { return this.drivers.find((d) => d.user_id === userId) ?? null; }
  async createDriver(d: Partial<DriverRow>) { return this.seedDriver(d as any); }
  async updateDriver(id: string, patch: Partial<DriverRow>) {
    const d = this.drivers.find((x) => x.id === id)!;
    Object.assign(d, patch, { updated_at: now() });
    return d;
  }

  async upsertDriverLocation(loc: Partial<DriverLocationRow> & { driver_id: string }) {
    const existing = this.locations.find((l) => l.driver_id === loc.driver_id);
    if (existing) { Object.assign(existing, loc, { updated_at: loc.updated_at ?? now() }); return existing; }
    return this.seedLocation(loc);
  }
  async getDriverLocation(driverId: string) { return this.locations.find((l) => l.driver_id === driverId) ?? null; }

  async findNearbyDrivers(lat: number, lng: number, radiusKm: number, serviceType: string): Promise<NearbyDriverRow[]> {
    const staleCutoff = Date.now() - 2 * 60 * 1000;
    const out: NearbyDriverRow[] = [];
    for (const d of this.drivers) {
      if (!d.is_verified || !d.is_available) continue;
      const u = this.users.find((x) => x.id === d.user_id);
      if (!u || !u.is_active) continue;
      const l = this.locations.find((x) => x.driver_id === d.id);
      if (!l || !l.is_online || l.latitude == null || l.longitude == null) continue;
      if (new Date(l.updated_at).getTime() < staleCutoff) continue;
      if (serviceType) {
        const map: Record<string, boolean> = {
          local: d.service_local, outstation: d.service_outstation, airport: d.service_airport,
          monthly: d.service_monthly, night: d.service_night,
        };
        if (!map[serviceType]) continue;
      }
      const distance = haversineKm(lat, lng, l.latitude, l.longitude);
      if (distance > radiusKm) continue;
      out.push({
        driver_id: d.id, user_id: d.user_id, full_name: u.full_name, phone: u.phone,
        rating: d.rating, total_trips: d.total_trips, experience_years: d.experience_years,
        languages: d.languages, price_per_trip: d.price_per_trip,
        is_verified: d.is_verified, is_available: d.is_available,
        latitude: l.latitude, longitude: l.longitude, distance_km: distance,
        service_local: d.service_local, service_outstation: d.service_outstation,
        service_airport: d.service_airport, service_monthly: d.service_monthly, service_night: d.service_night,
      });
    }
    return out.sort((a, b) => a.distance_km - b.distance_km);
  }

  async upsertVehicle(customerId: string, vehicleNumber: string, vehicleModel?: string | null, isDefault = true) {
    if (isDefault) {
      for (const x of this.vehicles) {
        if (x.customer_id === customerId) x.is_default = false;
      }
    }
    let v = this.vehicles.find((x) => x.customer_id === customerId && x.vehicle_number === vehicleNumber);
    if (v) {
      v.vehicle_model = vehicleModel ?? v.vehicle_model;
      v.is_default = isDefault;
      return v;
    }
    v = {
      id: uuid(), customer_id: customerId, vehicle_number: vehicleNumber,
      vehicle_model: vehicleModel ?? null, vehicle_type: null, is_default: isDefault,
      created_at: now(), updated_at: now(),
    };
    this.vehicles.push(v);
    return v;
  }

  async getDefaultVehicle(customerId: string) {
    return this.vehicles.find((x) => x.customer_id === customerId && x.is_default) ?? null;
  }

  async insertBooking(b: Partial<BookingRow>) {
    const row = { id: uuid(), created_at: now(), updated_at: now(), ...b } as BookingRow;
    this.bookings.push(row);
    return row;
  }
  async getBookingById(id: string) { return this.bookings.find((b) => b.id === id) ?? null; }
  async updateBooking(id: string, patch: Partial<BookingRow>) {
    const b = this.bookings.find((x) => x.id === id)!;
    Object.assign(b, patch, { updated_at: now() });
    return b;
  }
  async listBookingsByCustomer(customerId: string) { return this.bookings.filter((b) => b.customer_id === customerId); }
  async listBookingsByDriver(driverId: string) { return this.bookings.filter((b) => b.driver_id === driverId); }
  async listCompletedCollectedByDriver(driverId: string) {
    return this.bookings.filter((b) => b.driver_id === driverId && b.status === "completed" && b.payment_status === "paid");
  }

  async insertBookingEvent(e: any) { this.events.push({ id: uuid(), created_at: now(), ...e }); }

  async insertPayment(p: Partial<PaymentRow>) {
    const row = {
      id: uuid(), currency: "INR", method: "cod", gateway_order_id: null, gateway_payment_id: null,
      gateway_signature: null, status: "pending", collected_by: null, collected_at: null,
      created_at: now(), updated_at: now(), ...p,
    } as PaymentRow;
    this.payments.push(row);
    return row;
  }
  async getPaymentByBookingId(bookingId: string) {
    return this.payments.filter((p) => p.booking_id === bookingId).at(-1) ?? null;
  }
  async getPaymentByGatewayOrderId(gatewayOrderId: string) {
    return this.payments.find((p) => p.gateway_order_id === gatewayOrderId) ?? null;
  }
  async updatePayment(id: string, patch: Partial<PaymentRow>) {
    const p = this.payments.find((x) => x.id === id)!;
    Object.assign(p, patch, { updated_at: now() });
    return p;
  }

  async insertReview(r: Partial<ReviewRow>) {
    const row = { id: uuid(), comment: null, reviewer_role: "customer", created_at: now(), ...r } as ReviewRow;
    this.reviews.push(row);
    return row;
  }
  async getReviewByBookingId(bookingId: string) { return this.reviews.find((r) => r.booking_id === bookingId) ?? null; }
  async getReviewByBookingAndRole(bookingId: string, reviewerRole: string) { return this.reviews.find((r) => r.booking_id === bookingId && r.reviewer_role === reviewerRole) ?? null; }
  async listReviewsByDriver(driverId: string) { return this.reviews.filter((r) => r.driver_id === driverId); }
  async listReviewsByCustomer(customerId: string) { return this.reviews.filter((r) => r.customer_id === customerId); }

  async insertNotification(n: any) { this.notifications.push({ id: uuid(), created_at: now(), ...n }); }
}

// Mocked notifier: logs to notifications table, no FCM network call.
export const mockNotifier = async (db: any, userId: string, msg: any) => {
  await db.insertNotification({ user_id: userId, title: msg.title, body: msg.body, data: msg.data ?? {} });
};

export const asAuth = (u: UserRow) => ({ id: u.id, role: u.role as any, phone: u.phone });
