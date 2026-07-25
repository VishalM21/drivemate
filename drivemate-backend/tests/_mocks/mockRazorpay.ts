// Fake RazorpayGateway — zero network, fully controllable per-test.
import type { RazorpayGateway, RazorpayOrder, RazorpayPaymentEntity } from "../../supabase/functions/_shared/razorpay.ts";

let seq = 0;

export class MockRazorpayGateway implements RazorpayGateway {
  /** Toggle to make the next verifyPaymentSignature/verifyWebhookSignature call fail. */
  signatureValid = true;
  /** Override to simulate a captured/failed/amount-mismatched payment from fetchPayment. */
  paymentOverride: Partial<RazorpayPaymentEntity> = {};

  lastOrder: RazorpayOrder | null = null;

  async createOrder(amountRupees: number, receipt: string, _notes: Record<string, string>): Promise<RazorpayOrder> {
    const order = { id: `order_mock_${++seq}`, amount: Math.round(amountRupees * 100), currency: "INR" };
    this.lastOrder = order;
    return order;
  }

  async fetchPayment(paymentId: string): Promise<RazorpayPaymentEntity> {
    return {
      id: paymentId,
      order_id: this.lastOrder?.id ?? "order_mock_unknown",
      status: "captured",
      method: "card",
      amount: this.lastOrder?.amount ?? 0,
      currency: "INR",
      ...this.paymentOverride,
    };
  }

  async verifyPaymentSignature(_orderId: string, _paymentId: string, _signature: string): Promise<boolean> {
    return this.signatureValid;
  }

  async verifyWebhookSignature(_rawBody: string, _signature: string): Promise<boolean> {
    return this.signatureValid;
  }

  publicKeyId(): string {
    return "rzp_test_mock";
  }
}
