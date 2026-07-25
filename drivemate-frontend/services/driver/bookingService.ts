import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, Booking, BookingIdRequest, DeclineBookingRequest } from '@/types';

export function acceptBooking(body: BookingIdRequest): Promise<Booking> {
  return unwrap(apiClient.post<ApiResponse<Booking>>(ENDPOINTS.bookingsAccept, body));
}

export function declineBooking(body: DeclineBookingRequest): Promise<Booking> {
  return unwrap(apiClient.post<ApiResponse<Booking>>(ENDPOINTS.bookingsDecline, body));
}

export function markDriverArrived(body: BookingIdRequest): Promise<Booking> {
  return unwrap(apiClient.post<ApiResponse<Booking>>(ENDPOINTS.bookingsArrived, body));
}

export function startTrip(body: BookingIdRequest): Promise<Booking> {
  return unwrap(apiClient.post<ApiResponse<Booking>>(ENDPOINTS.bookingsStart, body));
}

export function completeTrip(body: BookingIdRequest): Promise<Booking> {
  return unwrap(apiClient.post<ApiResponse<Booking>>(ENDPOINTS.bookingsComplete, body));
}
