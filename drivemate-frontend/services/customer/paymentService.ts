import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, BookingIdRequest, Payment, RazorpayOrderResponse, VerifyRazorpayPaymentRequest } from '@/types';

export function createRazorpayOrder(body: BookingIdRequest): Promise<RazorpayOrderResponse> {
  return unwrap(
    apiClient.post<ApiResponse<RazorpayOrderResponse>>(ENDPOINTS.paymentsCreateOrder, body),
  );
}

export function verifyRazorpayPayment(body: VerifyRazorpayPaymentRequest): Promise<Payment> {
  return unwrap(
    apiClient.post<ApiResponse<Payment>>(ENDPOINTS.paymentsVerify, body),
  );
}
