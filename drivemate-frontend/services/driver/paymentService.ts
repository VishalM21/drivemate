import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, BookingIdRequest, Payment } from '@/types';

export function markCodCollected(body: BookingIdRequest): Promise<Payment> {
  return unwrap(
    apiClient.post<ApiResponse<Payment>>(ENDPOINTS.paymentsMarkCodCollected, body),
  );
}
