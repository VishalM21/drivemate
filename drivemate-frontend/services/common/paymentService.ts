import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, Payment } from '@/types';

export function fetchPaymentByBooking(bookingId: string): Promise<Payment> {
  return unwrap(
    apiClient.get<ApiResponse<Payment>>(ENDPOINTS.paymentsGetByBooking, {
      params: { bookingId },
    }),
  );
}
