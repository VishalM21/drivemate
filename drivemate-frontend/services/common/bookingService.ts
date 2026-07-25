import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, Booking, BookingHistoryResponse } from '@/types';

export function fetchBooking(bookingId: string): Promise<Booking> {
  return unwrap(
    apiClient.get<ApiResponse<Booking>>(ENDPOINTS.bookingsGet, { params: { bookingId } }),
  );
}

export function fetchBookingHistory(): Promise<BookingHistoryResponse> {
  return unwrap(
    apiClient.get<ApiResponse<BookingHistoryResponse>>(ENDPOINTS.bookingsHistory),
  );
}
