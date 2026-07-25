import type { PaymentMethod } from './booking.types';

export type PaymentRecordStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  collectedBy: string | null;
  collectedAt: string | null;
  createdAt: string;
}

export interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyRazorpayPaymentRequest {
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}
