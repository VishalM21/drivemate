// snake_case DB rows -> camelCase API shapes.
import type { BookingRow, DriverRow, NearbyDriverRow, PaymentRow, ReviewRow, UserRow, VehicleRow } from "./types.ts";
import { etaMinutes } from "./fareCalculator.ts";

export function userToApi(u: UserRow) {
  return {
    id: u.id, phone: u.phone, role: u.role, fullName: u.full_name,
    email: u.email, avatarUrl: u.avatar_url, isActive: u.is_active,
    rideOtp: u.ride_otp,
    aadharNumber: u.aadhar_number, rcNumber: u.rc_number, carNumber: u.car_number, dlNumber: u.dl_number,
    dob: u.dob, carName: u.car_name, carRcName: u.car_rc_name,
    ratingAsCustomer: Number(u.rating_as_customer), totalTripsAsCustomer: u.total_trips_as_customer,
    createdAt: u.created_at,
  };
}

export function vehicleToApi(v: VehicleRow) {
  return {
    id: v.id, customerId: v.customer_id, vehicleNumber: v.vehicle_number,
    vehicleModel: v.vehicle_model, vehicleType: v.vehicle_type, isDefault: v.is_default,
  };
}

export function bookingToApi(b: BookingRow) {
  return {
    id: b.id, bookingNumber: b.booking_number, customerId: b.customer_id,
    driverId: b.driver_id, vehicleId: b.vehicle_id,
    serviceType: b.service_type, routeType: b.route_type,
    pickupAddress: b.pickup_address, pickupLatitude: b.pickup_latitude, pickupLongitude: b.pickup_longitude,
    dropAddress: b.drop_address, dropLatitude: b.drop_latitude, dropLongitude: b.drop_longitude,
    scheduledAt: b.scheduled_at, startedAt: b.started_at, completedAt: b.completed_at, cancelledAt: b.cancelled_at,
    status: b.status,
    driverFee: Number(b.driver_fee), platformFee: Number(b.platform_fee),
    taxAmount: Number(b.tax_amount), totalAmount: Number(b.total_amount),
    paymentStatus: b.payment_status, paymentMethod: b.payment_method,
    cancellationReason: b.cancellation_reason, createdAt: b.created_at, updatedAt: b.updated_at,
  };
}

export function paymentToApi(p: PaymentRow) {
  return {
    id: p.id, bookingId: p.booking_id, amount: Number(p.amount), currency: p.currency,
    method: p.method, status: p.status, gatewayOrderId: p.gateway_order_id,
    gatewayPaymentId: p.gateway_payment_id, collectedBy: p.collected_by,
    collectedAt: p.collected_at, createdAt: p.created_at,
  };
}

export function reviewToApi(r: ReviewRow) {
  return {
    id: r.id, bookingId: r.booking_id, customerId: r.customer_id, driverId: r.driver_id,
    rating: r.rating, comment: r.comment, reviewerRole: r.reviewer_role, createdAt: r.created_at,
  };
}

export function driverToApi(d: DriverRow) {
  return {
    id: d.id, userId: d.user_id, rating: Number(d.rating), totalTrips: d.total_trips,
    experienceYears: d.experience_years, languages: d.languages, pricePerTrip: Number(d.price_per_trip),
    isVerified: d.is_verified, isAvailable: d.is_available,
    serviceLocal: d.service_local, serviceOutstation: d.service_outstation,
    serviceAirport: d.service_airport, serviceMonthly: d.service_monthly, serviceNight: d.service_night,
    licenseNumber: d.license_number, email: d.email,
  };
}

export function nearbyDriverToApi(r: NearbyDriverRow) {
  const name = r.full_name ?? "Driver";
  const avatar = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "DR";
  const distanceKm = Math.round(r.distance_km * 10) / 10;
  return {
    id: r.driver_id,
    userId: r.user_id,
    name,
    phone: r.phone,
    avatar,
    rating: Number(r.rating),
    totalTrips: r.total_trips,
    experience: `${r.experience_years} years`,
    languages: r.languages,
    pricePerTrip: Number(r.price_per_trip),
    isVerified: r.is_verified,
    isAvailable: r.is_available,
    location: { latitude: r.latitude, longitude: r.longitude },
    distanceKm,
    etaMinutes: etaMinutes(distanceKm),
    serviceLocal: r.service_local,
    serviceOutstation: r.service_outstation,
    serviceAirport: r.service_airport,
    serviceMonthly: r.service_monthly,
    serviceNight: r.service_night,
  };
}
