// Razorpay client as an injectable interface — same reasoning as Db/Notifier
// (see db.ts): keeps `deno test` network-free. `createLiveRazorpayGateway()`
// is the real implementation edge functions use; tests inject a fake.
import { serverError } from "./errors.ts";

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

/** Length-checked XOR compare; fine for this call volume (not a hot loop). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  status: string; // created | authorized | captured | failed | refunded
  method: string; // card | upi | netbanking | wallet | emi
  amount: number;
  currency: string;
}

export interface RazorpayGateway {
  createOrder(amountRupees: number, receipt: string, notes: Record<string, string>): Promise<RazorpayOrder>;
  fetchPayment(paymentId: string): Promise<RazorpayPaymentEntity>;
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): Promise<boolean>;
  verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean>;
  publicKeyId(): string;
}

/** Rupees -> paise, the smallest unit Razorpay's API expects. */
function toPaise(amountRupees: number): number {
  return Math.round(amountRupees * 100);
}

export function createLiveRazorpayGateway(): RazorpayGateway {
  const keyId = () => {
    const v = (globalThis as any).Deno?.env?.get?.("RAZORPAY_KEY_ID");
    if (!v) throw serverError("RAZORPAY_KEY_ID not configured");
    return v;
  };
  const keySecret = () => {
    const v = (globalThis as any).Deno?.env?.get?.("RAZORPAY_KEY_SECRET");
    if (!v) throw serverError("RAZORPAY_KEY_SECRET not configured");
    return v;
  };
  const webhookSecret = () => {
    const v = (globalThis as any).Deno?.env?.get?.("RAZORPAY_WEBHOOK_SECRET");
    if (!v) throw serverError("RAZORPAY_WEBHOOK_SECRET not configured");
    return v;
  };
  const basicAuth = () => btoa(`${keyId()}:${keySecret()}`);

  return {
    async createOrder(amountRupees, receipt, notes) {
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${basicAuth()}` },
        body: JSON.stringify({ amount: toPaise(amountRupees), currency: "INR", receipt, notes, payment_capture: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw serverError(`Razorpay order creation failed: ${data?.error?.description ?? res.statusText}`);
      return { id: data.id, amount: data.amount, currency: data.currency };
    },
    async fetchPayment(paymentId) {
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Basic ${basicAuth()}` },
      });
      const data = await res.json();
      if (!res.ok) throw serverError(`Razorpay payment lookup failed: ${data?.error?.description ?? res.statusText}`);
      return data;
    },
    async verifyPaymentSignature(orderId, paymentId, signature) {
      const expected = await hmacHex(`${orderId}|${paymentId}`, keySecret());
      return safeEqual(expected, signature);
    },
    async verifyWebhookSignature(rawBody, signature) {
      const expected = await hmacHex(rawBody, webhookSecret());
      return safeEqual(expected, signature);
    },
    publicKeyId: keyId,
  };
}
