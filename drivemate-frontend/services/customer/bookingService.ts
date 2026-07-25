import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, Booking, CancelBookingRequest, CreateBookingRequest } from '@/types';

export function createBooking(body: CreateBookingRequest): Promise<Booking> {
  return unwrap(apiClient.post<ApiResponse<Booking>>(ENDPOINTS.bookingsCreate, body));
}

export function cancelBooking(body: CancelBookingRequest): Promise<Booking> {
  return unwrap(apiClient.post<ApiResponse<Booking>>(ENDPOINTS.bookingsCancel, body));
}
