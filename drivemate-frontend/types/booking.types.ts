export type ServiceType = 'local' | 'outstation' | 'airport' | 'monthly';
export type RouteType = 'one_way' | 'round_trip' | 'hourly';

export type BookingStatus =
  | 'pending'
  | 'driver_notified'
  | 'driver_accepted'
  | 'driver_arriving'
  | 'arrived'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'cod' | 'online' | 'card' | 'upi' | 'netbanking' | 'wallet' | 'emi';

export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  driverId: string;
  vehicleId: string | null;
  serviceType: ServiceType;
  routeType: RouteType | null;
  pickupAddress: string | null;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  dropAddress: string | null;
  dropLatitude: number | null;
  dropLongitude: number | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  status: BookingStatus;
  driverFee: number;
  platformFee: number;
  taxAmount: number;
  totalAmount: number;
  surgeMultiplier: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  driver?: {
    id: string;
    name: string;
    phone: string;
    rating: number;
    avatar: string | null;
  } | null;
  driverLocation?: {
    latitude: number;
    longitude: number;
    heading: number | null;
  } | null;
}

export interface CreateBookingRequest {
  driverId: string;
  serviceType: ServiceType;
  routeType?: RouteType;
  pickupAddress?: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropAddress?: string;
  dropLatitude?: number;
  dropLongitude?: number;
  scheduledAt?: string;
  vehicleNumber: string;
  vehicleModel?: string;
  /** false when the vehicle was edited for just this ride — leaves the
   * customer's saved default vehicle untouched. Omitted/true saves it as
   * the new default (also how a customer's very first vehicle gets saved). */
  setAsDefault?: boolean;
}

export interface Vehicle {
  id: string;
  customerId: string;
  vehicleNumber: string;
  vehicleModel: string | null;
  vehicleType: string | null;
  isDefault: boolean;
}

export interface BookingIdRequest {
  bookingId: string;
  otp?: string;
}

export interface CancelBookingRequest extends BookingIdRequest {
  reason?: string;
}

export interface DeclineBookingRequest extends BookingIdRequest {
  reason?: string;
}

export interface BookingHistoryResponse {
  bookings: Booking[];
}
