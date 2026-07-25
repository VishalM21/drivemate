import { useMutation, useQueryClient } from '@tanstack/react-query';
import RazorpayCheckout, { RazorpayErrorResult } from 'react-native-razorpay';

import { createRazorpayOrder, verifyRazorpayPayment } from '@/services/customer/paymentService';
import type { Booking, Payment } from '@/types';

/** Razorpay rejects with this code when the user closes the sheet themselves. */
const USER_CANCELLED_CODE = 2;

export function useOnlinePayment(bookingId: string | undefined) {
  const queryClient = useQueryClient();

  const payMutation = useMutation({
    mutationFn: async (booking: Booking): Promise<Payment> => {
      const order = await createRazorpayOrder({ bookingId: booking.id });

      let result;
      try {
        result = await RazorpayCheckout.open({
          key: order.keyId,
          order_id: order.razorpayOrderId,
          amount: order.amount,
          currency: order.currency,
          name: 'DriveMate',
          description: `Trip ${booking.bookingNumber}`,
          theme: { color: '#0F62FE' },
        });
      } catch (err) {
        const razorpayErr = err as RazorpayErrorResult;
        if (razorpayErr?.code === USER_CANCELLED_CODE) {
          throw new Error('Payment cancelled.');
        }
        throw new Error(razorpayErr?.description || 'Payment failed. Please try again.');
      }

      return verifyRazorpayPayment({
        bookingId: booking.id,
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      });
    },
    onSuccess: () => {
      // Pulls the now-'paid' status in immediately rather than waiting on
      // the next poll tick / realtime round-trip.
      queryClient.invalidateQueries({ queryKey: ['activeBooking', bookingId] });
    },
  });

  return {
    payOnline: payMutation.mutateAsync,
    isProcessing: payMutation.isPending,
    error: payMutation.error as Error | null,
  };
}
