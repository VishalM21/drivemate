import type { Db } from "./db.ts";
import type { AuthUser } from "./roleGuards.ts";
import type { Notifier } from "./notify.ts";
import { badRequest, conflict, forbidden, notFound } from "./errors.ts";
import { paymentToApi } from "./mappers.ts";
import type { RazorpayGateway } from "./razorpay.ts";

export async function markCodCollected(db: Db, notify: Notifier, auth: AuthUser, body: { bookingId?: string }) {
  if (!body?.bookingId) throw badRequest("bookingId is required");
  const booking = await db.getBookingById(body.bookingId);
  if (!booking) throw notFound("Booking not found");

  // Only the assigned driver or an admin may confirm cash collection.
  if (auth.role !== "admin") {
    if (auth.role !== "driver") throw forbidden("Only the assigned driver or admin can mark COD collected");
    const driver = await db.getDriverByUserId(auth.id);
    if (!driver || booking.driver_id !== driver.id) throw forbidden("Booking is not assigned to you");
  }

  if (booking.status !== "completed") throw conflict("COD can only be collected after the trip is completed");
  if (booking.payment_status === "paid") throw conflict("Payment already settled for this booking");

  const payment = await db.getPaymentByBookingId(booking.id);
  if (!payment) throw notFound("Payment record not found for booking");
  if (payment.method !== "cod") {
    throw conflict("This booking is being paid online — cash collection is not applicable");
  }

  const now = new Date().toISOString();
  const updatedPayment = await db.updatePayment(payment.id, {
    status: "paid", collected_by: auth.id, collected_at: now,
  });
  await db.updateBooking(booking.id, { payment_status: "paid" });
  await db.insertBookingEvent({
    booking_id: booking.id, event_type: "cod_collected",
    old_status: booking.status, new_status: booking.status,
    created_by: auth.id, metadata: { amount: payment.amount },
  });
  await notify(db, booking.customer_id, {
    title: "Payment received",
    body: `Cash payment of ₹${Number(payment.amount)} confirmed for booking ${booking.booking_number}. Thank you!`,
    data: { type: "cod_collected", bookingId: booking.id },
  });
  return paymentToApi(updatedPayment);
}

/** Customer starts an online payment: create a Razorpay order for the trip's total_amount. */
export async function createRazorpayOrder(db: Db, gateway: RazorpayGateway, auth: AuthUser, body: { bookingId?: string }) {
  if (!body?.bookingId) throw badRequest("bookingId is required");
  const booking = await db.getBookingById(body.bookingId);
  if (!booking) throw notFound("Booking not found");
  if (auth.role !== "admin" && booking.customer_id !== auth.id) throw forbidden("Not your booking");
  if (booking.status !== "completed") throw conflict("Payment can only be started after the trip is completed");
  if (booking.payment_status === "paid") throw conflict("Payment already settled for this booking");

  const order = await gateway.createOrder(Number(booking.total_amount), booking.booking_number, { bookingId: booking.id });

  await db.insertPayment({
    booking_id: booking.id, amount: Number(booking.total_amount), currency: "INR",
    method: "online", status: "pending", gateway_order_id: order.id,
  });

  return {
    razorpayOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: gateway.publicKeyId(),
  };
}

/** Customer's app calls this right after the Checkout SDK returns a successful result. */
export async function verifyRazorpayPayment(
  db: Db,
  notify: Notifier,
  gateway: RazorpayGateway,
  auth: AuthUser,
  body: { bookingId?: string; razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string },
) {
  const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body ?? {};
  if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw badRequest("bookingId, razorpayOrderId, razorpayPaymentId and razorpaySignature are all required");
  }
  const booking = await db.getBookingById(bookingId);
  if (!booking) throw notFound("Booking not found");
  if (auth.role !== "admin" && booking.customer_id !== auth.id) throw forbidden("Not your booking");

  const payment = await db.getPaymentByGatewayOrderId(razorpayOrderId);
  if (!payment || payment.booking_id !== booking.id) throw notFound("Payment order not found for this booking");

  // Idempotent: a retried client call after a dropped response shouldn't re-verify or double-notify.
  if (payment.status === "paid") return paymentToApi(payment);

  const validSignature = await gateway.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!validSignature) throw badRequest("Invalid payment signature");

  // Belt-and-braces: confirm directly with Razorpay's API (amount/currency/status),
  // rather than trusting the client-supplied IDs alone, and pull the real method used.
  const gatewayPayment = await gateway.fetchPayment(razorpayPaymentId);
  if (gatewayPayment.order_id !== razorpayOrderId) throw badRequest("Payment does not belong to this order");
  if (gatewayPayment.status !== "captured") throw conflict(`Payment not captured (status: ${gatewayPayment.status})`);
  if (gatewayPayment.amount !== Math.round(Number(payment.amount) * 100)) throw conflict("Payment amount mismatch");

  const now = new Date().toISOString();
  const updatedPayment = await db.updatePayment(payment.id, {
    status: "paid", method: gatewayPayment.method, gateway_payment_id: razorpayPaymentId,
    gateway_signature: razorpaySignature, collected_by: auth.id, collected_at: now,
  });
  await db.updateBooking(booking.id, { payment_status: "paid", payment_method: gatewayPayment.method });
  await db.insertBookingEvent({
    booking_id: booking.id, event_type: "online_payment_verified",
    old_status: booking.status, new_status: booking.status,
    created_by: auth.id, metadata: { amount: payment.amount, method: gatewayPayment.method },
  });
  await notify(db, booking.customer_id, {
    title: "Payment successful",
    body: `₹${Number(payment.amount)} paid online for booking ${booking.booking_number}. Thank you!`,
    data: { type: "online_payment_verified", bookingId: booking.id },
  });
  return paymentToApi(updatedPayment);
}

/**
 * Razorpay webhook — safety net for the case where the app is killed or the
 * network drops right after Checkout closes but before `verifyRazorpayPayment`
 * runs. Public endpoint: authenticated via HMAC over the raw body instead of
 * a JWT. Must be idempotent (Razorpay retries on non-2xx and can redeliver).
 */
export async function handleRazorpayWebhook(db: Db, notify: Notifier, gateway: RazorpayGateway, rawBody: string, signature: string | null) {
  if (!signature) throw badRequest("Missing webhook signature");
  const valid = await gateway.verifyWebhookSignature(rawBody, signature);
  if (!valid) throw badRequest("Invalid webhook signature");

  const event = JSON.parse(rawBody);
  const type = event?.event;
  if (type !== "payment.captured" && type !== "payment.failed") {
    return { ignored: true };
  }

  const entity = event?.payload?.payment?.entity;
  if (!entity?.order_id) return { ignored: true };

  const payment = await db.getPaymentByGatewayOrderId(entity.order_id);
  if (!payment) return { ignored: true }; // order not created through this system

  const booking = await db.getBookingById(payment.booking_id);
  if (!booking) return { ignored: true };

  // Idempotent no-op if already settled (e.g. verify-on-return already ran).
  if (booking.payment_status === "paid") return { alreadySettled: true };

  if (type === "payment.captured") {
    const now = new Date().toISOString();
    await db.updatePayment(payment.id, {
      status: "paid", method: entity.method, gateway_payment_id: entity.id, collected_at: now,
    });
    await db.updateBooking(booking.id, { payment_status: "paid", payment_method: entity.method });
    await db.insertBookingEvent({
      booking_id: booking.id, event_type: "online_payment_webhook_captured",
      old_status: booking.status, new_status: booking.status,
      metadata: { amount: payment.amount, method: entity.method },
    });
    await notify(db, booking.customer_id, {
      title: "Payment successful",
      body: `₹${Number(payment.amount)} paid online for booking ${booking.booking_number}. Thank you!`,
      data: { type: "online_payment_verified", bookingId: booking.id },
    });
  } else {
    await db.updatePayment(payment.id, { status: "failed" });
    // booking.payment_status stays 'pending' — the customer can retry online or fall back to cash.
  }
  return { handled: true };
}

export async function getPaymentByBooking(db: Db, auth: AuthUser, bookingId?: string | null) {
  if (!bookingId) throw badRequest("bookingId is required");
  const booking = await db.getBookingById(bookingId);
  if (!booking) throw notFound("Booking not found");

  if (auth.role !== "admin") {
    if (auth.role === "customer") {
      if (booking.customer_id !== auth.id) throw forbidden("Not your booking");
    } else {
      const driver = await db.getDriverByUserId(auth.id);
      if (!driver || booking.driver_id !== driver.id) throw forbidden("Booking is not assigned to you");
    }
  }
  const payment = await db.getPaymentByBookingId(bookingId);
  if (!payment) throw notFound("Payment record not found");
  return paymentToApi(payment);
}
