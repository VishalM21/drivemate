// Production Db implementation backed by supabase-js (service role).
import type { Db } from "./db.ts";
import { getServiceClient } from "./supabaseClient.ts";
import { serverError } from "./errors.ts";

function must<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw serverError(error.message);
  if (data === null) throw serverError("Unexpected empty result");
  return data;
}

export function createSupabaseDb(): Db {
  const sb = getServiceClient();
  return {
    async getUserByFirebaseUid(uid) {
      const { data } = await sb.from("users").select("*").eq("firebase_uid", uid).maybeSingle();
      return data ?? null;
    },
    async getUserByPhone(phone) {
      const { data } = await sb.from("users").select("*").eq("phone", phone).maybeSingle();
      return data ?? null;
    },
    async getUserById(id) {
      const { data } = await sb.from("users").select("*").eq("id", id).maybeSingle();
      return data ?? null;
    },
    async createUser(u) {
      const { data, error } = await sb.from("users").insert(u).select("*").single();
      return must(data, error);
    },
    async updateUser(id, patch) {
      const { data, error } = await sb.from("users").update(patch).eq("id", id).select("*").single();
      return must(data, error);
    },

    async getDriverById(id) {
      const { data } = await sb.from("drivers").select("*").eq("id", id).maybeSingle();
      return data ?? null;
    },
    async getDriverByUserId(userId) {
      const { data } = await sb.from("drivers").select("*").eq("user_id", userId).maybeSingle();
      return data ?? null;
    },
    async createDriver(d) {
      const { data, error } = await sb.from("drivers").insert(d).select("*").single();
      return must(data, error);
    },
    async updateDriver(id, patch) {
      const { data, error } = await sb.from("drivers").update(patch).eq("id", id).select("*").single();
      return must(data, error);
    },

    async upsertDriverLocation(loc) {
      const { data, error } = await sb
        .from("driver_locations")
        .upsert(loc, { onConflict: "driver_id" })
        .select("*")
        .single();
      return must(data, error);
    },
    async getDriverLocation(driverId) {
      const { data } = await sb.from("driver_locations").select("*").eq("driver_id", driverId).maybeSingle();
      return data ?? null;
    },
    async findNearbyDrivers(lat, lng, radiusKm, serviceType) {
      const { data, error } = await sb.rpc("nearby_drivers", {
        p_lat: lat, p_lng: lng, p_radius_km: radiusKm, p_service_type: serviceType,
      });
      if (error) throw serverError(error.message);
      return data ?? [];
    },

    async upsertVehicle(customerId, vehicleNumber, vehicleModel, isDefault = true) {
      if (isDefault) {
        await sb.from("vehicles").update({ is_default: false })
          .eq("customer_id", customerId).eq("is_default", true);
      }
      const { data, error } = await sb
        .from("vehicles")
        .upsert(
          { customer_id: customerId, vehicle_number: vehicleNumber, vehicle_model: vehicleModel ?? null, is_default: isDefault },
          { onConflict: "customer_id,vehicle_number" },
        )
        .select("*")
        .single();
      return must(data, error);
    },
    async getDefaultVehicle(customerId) {
      const { data } = await sb.from("vehicles").select("*")
        .eq("customer_id", customerId).eq("is_default", true).maybeSingle();
      return data ?? null;
    },

    async insertBooking(b) {
      const { data, error } = await sb.from("bookings").insert(b).select("*").single();
      return must(data, error);
    },
    async getBookingById(id) {
      const { data } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
      return data ?? null;
    },
    async updateBooking(id, patch) {
      const { data, error } = await sb.from("bookings").update(patch).eq("id", id).select("*").single();
      return must(data, error);
    },
    async listBookingsByCustomer(customerId) {
      const { data } = await sb.from("bookings").select("*").eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    async listBookingsByDriver(driverId) {
      const { data } = await sb.from("bookings").select("*").eq("driver_id", driverId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    async listCompletedCollectedByDriver(driverId) {
      const { data } = await sb.from("bookings").select("*")
        .eq("driver_id", driverId).eq("status", "completed").eq("payment_status", "paid");
      return data ?? [];
    },

    async countPendingBookingsNear(lat, lng, radiusKm) {
      const { data, error } = await sb.rpc("nearby_pending_bookings_count", {
        p_lat: lat, p_lng: lng, p_radius_km: radiusKm,
      });
      if (error) throw serverError(error.message);
      return data ?? 0;
    },

    async insertBookingEvent(e) {
      await sb.from("booking_events").insert(e);
    },

    async insertPayment(p) {
      const { data, error } = await sb.from("payments").insert(p).select("*").single();
      return must(data, error);
    },
    async getPaymentByBookingId(bookingId) {
      const { data } = await sb.from("payments").select("*").eq("booking_id", bookingId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data ?? null;
    },
    async getPaymentByGatewayOrderId(gatewayOrderId) {
      const { data } = await sb.from("payments").select("*").eq("gateway_order_id", gatewayOrderId).maybeSingle();
      return data ?? null;
    },
    async updatePayment(id, patch) {
      const { data, error } = await sb.from("payments").update(patch).eq("id", id).select("*").single();
      return must(data, error);
    },

    async insertReview(r) {
      const { data, error } = await sb.from("reviews").insert(r).select("*").single();
      return must(data, error);
    },
    async getReviewByBookingId(bookingId) {
      const { data } = await sb.from("reviews").select("*").eq("booking_id", bookingId).maybeSingle();
      return data ?? null;
    },
    async getReviewByBookingAndRole(bookingId, reviewerRole) {
      const { data } = await sb.from("reviews").select("*").eq("booking_id", bookingId).eq("reviewer_role", reviewerRole).maybeSingle();
      return data ?? null;
    },
    async listReviewsByDriver(driverId) {
      const { data } = await sb.from("reviews").select("*").eq("driver_id", driverId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    async listReviewsByCustomer(customerId) {
      const { data } = await sb.from("reviews").select("*").eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },

    async insertNotification(n) {
      await sb.from("notifications").insert(n);
    },
  };
}
