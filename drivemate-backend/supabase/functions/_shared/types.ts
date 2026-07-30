// Row types shared by services and the DB layer.
export interface UserRow {
  id: string; firebase_uid: string; phone: string; role: string;
  full_name: string | null; email: string | null; avatar_url: string | null;
  fcm_token: string | null; is_active: boolean; ride_otp: string | null;
  aadhar_number: string | null; rc_number: string | null; car_number: string | null; dl_number: string | null;
  dob: string | null; car_name: string | null; car_rc_name: string | null;
  rating_as_customer: number; total_trips_as_customer: number;
  created_at: string; updated_at: string;
}
export interface DriverRow {
  id: string; user_id: string; rating: number; total_trips: number; experience_years: number;
  languages: string[]; price_per_trip: number; is_verified: boolean; is_available: boolean;
  service_local: boolean; service_outstation: boolean; service_airport: boolean;
  service_monthly: boolean; service_night: boolean; license_number: string; email: string | null;
  created_at: string; updated_at: string;
}
export interface DriverLocationRow {
  id: string; driver_id: string; latitude: number | null; longitude: number | null;
  heading: number | null; speed: number | null; accuracy: number | null;
  is_online: boolean; updated_at: string;
}
export interface VehicleRow {
  id: string; customer_id: string; vehicle_number: string; vehicle_model: string | null;
  vehicle_type: string | null; is_default: boolean; created_at: string; updated_at: string;
}
export interface BookingRow {
  id: string; booking_number: string; customer_id: string; driver_id: string; vehicle_id: string | null;
  service_type: string; route_type: string | null;
  pickup_address: string | null; pickup_latitude: number | null; pickup_longitude: number | null;
  drop_address: string | null; drop_latitude: number | null; drop_longitude: number | null;
  scheduled_at: string | null; started_at: string | null; completed_at: string | null; cancelled_at: string | null;
  status: string; driver_fee: number; platform_fee: number; tax_amount: number; total_amount: number;
  surge_multiplier: number;
  payment_status: string; payment_method: string; cancellation_reason: string | null;
  created_at: string; updated_at: string;
}
export interface PaymentRow {
  id: string; booking_id: string; amount: number; currency: string; method: string;
  gateway_order_id: string | null; gateway_payment_id: string | null; gateway_signature: string | null;
  status: string; collected_by: string | null; collected_at: string | null;
  created_at: string; updated_at: string;
}
export interface ReviewRow {
  id: string; booking_id: string; customer_id: string; driver_id: string;
  rating: number; comment: string | null; reviewer_role: string; created_at: string;
}
export interface NearbyDriverRow {
  driver_id: string; user_id: string; full_name: string | null; phone: string;
  rating: number; total_trips: number; experience_years: number; languages: string[];
  price_per_trip: number; is_verified: boolean; is_available: boolean;
  latitude: number; longitude: number; distance_km: number;
  service_local: boolean; service_outstation: boolean; service_airport: boolean;
  service_monthly: boolean; service_night: boolean;
}
