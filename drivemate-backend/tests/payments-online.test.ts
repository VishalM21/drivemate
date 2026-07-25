import { assert, assertEquals, assertRejects } from "./_mocks/assert.ts";
import { makeWorld, asAuth } from "./_mocks/fixtures.ts";
import { mockNotifier } from "./_mocks/memoryDb.ts";
import { MockRazorpayGateway } from "./_mocks/mockRazorpay.ts";
import { createBooking, acceptBooking, markArrived, startTrip, completeTrip } from "../supabase/functions/_shared/bookingService.ts";
import { markCodCollected, createRazorpayOrder, verifyRazorpayPayment, handleRazorpayWebhook } from "../supabase/functions/_shared/paymentService.ts";
import { ApiError } from "../supabase/functions/_shared/errors.ts";

const body = (driverId: string) => ({
  driverId, serviceType: "local",
  pickupLatitude: 26.44, pickupLongitude: 80.33, vehicleNumber: "UP78CC0007",
});

async function toCompleted(w: ReturnType<typeof makeWorld>) {
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  const drv = asAuth(w.driverUser);
  await acceptBooking(w.db, mockNotifier, drv, { bookingId: b.id });
  await markArrived(w.db, mockNotifier, drv, { bookingId: b.id });
  await startTrip(w.db, mockNotifier, drv, { bookingId: b.id, otp: "1234" });
  await completeTrip(w.db, mockNotifier, drv, { bookingId: b.id });
  return b;
}

Deno.test("cannot create a Razorpay order before the trip is completed", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await createBooking(w.db, mockNotifier, asAuth(w.customer), body(w.driver.id));
  await assertRejects(
    () => createRazorpayOrder(w.db, gateway, asAuth(w.customer), { bookingId: b.id }),
    ApiError, "after the trip is completed",
  );
});

Deno.test("only the booking's own customer can create an order", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await toCompleted(w);
  await assertRejects(
    () => createRazorpayOrder(w.db, gateway, asAuth(w.otherCustomer), { bookingId: b.id }),
    ApiError, "Not your booking",
  );
});

Deno.test("create order -> verify happy path settles the booking as paid", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await toCompleted(w);

  const order = await createRazorpayOrder(w.db, gateway, asAuth(w.customer), { bookingId: b.id });
  assert(order.razorpayOrderId);
  assertEquals(order.keyId, "rzp_test_mock");

  const verified = await verifyRazorpayPayment(w.db, mockNotifier, gateway, asAuth(w.customer), {
    bookingId: b.id, razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: "pay_mock_1", razorpaySignature: "sig",
  });
  assertEquals(verified.status, "paid");
  assertEquals(verified.method, "card");

  const updated = await w.db.getBookingById(b.id);
  assertEquals(updated?.payment_status, "paid");
  assertEquals(updated?.payment_method, "card");
  assert(w.db.notifications.some((n) => n.user_id === w.customer.id && n.title === "Payment successful"));
});

Deno.test("verify rejects an invalid signature", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await toCompleted(w);
  const order = await createRazorpayOrder(w.db, gateway, asAuth(w.customer), { bookingId: b.id });

  gateway.signatureValid = false;
  await assertRejects(
    () => verifyRazorpayPayment(w.db, mockNotifier, gateway, asAuth(w.customer), {
      bookingId: b.id, razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: "pay_mock_1", razorpaySignature: "bad",
    }),
    ApiError, "Invalid payment signature",
  );
  assertEquals((await w.db.getBookingById(b.id))?.payment_status, "pending");
});

Deno.test("verify rejects an amount mismatch", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await toCompleted(w);
  const order = await createRazorpayOrder(w.db, gateway, asAuth(w.customer), { bookingId: b.id });

  gateway.paymentOverride = { amount: 1 }; // 1 paisa, won't match the booking total
  await assertRejects(
    () => verifyRazorpayPayment(w.db, mockNotifier, gateway, asAuth(w.customer), {
      bookingId: b.id, razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: "pay_mock_1", razorpaySignature: "sig",
    }),
    ApiError, "amount mismatch",
  );
});

Deno.test("verify is idempotent on a retried call", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await toCompleted(w);
  const order = await createRazorpayOrder(w.db, gateway, asAuth(w.customer), { bookingId: b.id });

  const args = [w.db, mockNotifier, gateway, asAuth(w.customer), {
    bookingId: b.id, razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: "pay_mock_1", razorpaySignature: "sig",
  }] as const;
  await verifyRazorpayPayment(...args);
  const second = await verifyRazorpayPayment(...args); // should not throw / re-notify
  assertEquals(second.status, "paid");
  assertEquals(w.db.notifications.filter((n) => n.title === "Payment successful").length, 1);
});

Deno.test("cash collection is rejected once a booking is paying online", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await toCompleted(w);
  await createRazorpayOrder(w.db, gateway, asAuth(w.customer), { bookingId: b.id });

  await assertRejects(
    () => markCodCollected(w.db, mockNotifier, asAuth(w.driverUser), { bookingId: b.id }),
    ApiError, "not applicable",
  );
});

Deno.test("webhook: payment.captured settles the booking (and is idempotent)", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await toCompleted(w);
  const order = await createRazorpayOrder(w.db, gateway, asAuth(w.customer), { bookingId: b.id });

  const rawBody = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_mock_2", order_id: order.razorpayOrderId, method: "upi" } } },
  });
  const first = await handleRazorpayWebhook(w.db, mockNotifier, gateway, rawBody, "sig");
  assertEquals(first, { handled: true });
  assertEquals((await w.db.getBookingById(b.id))?.payment_status, "paid");
  assertEquals((await w.db.getBookingById(b.id))?.payment_method, "upi");

  const second = await handleRazorpayWebhook(w.db, mockNotifier, gateway, rawBody, "sig");
  assertEquals(second, { alreadySettled: true });
  assertEquals(w.db.notifications.filter((n) => n.title === "Payment successful").length, 1);
});

Deno.test("webhook: payment.failed marks the payment failed but leaves the booking retryable", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  const b = await toCompleted(w);
  const order = await createRazorpayOrder(w.db, gateway, asAuth(w.customer), { bookingId: b.id });

  const rawBody = JSON.stringify({
    event: "payment.failed",
    payload: { payment: { entity: { id: "pay_mock_3", order_id: order.razorpayOrderId, method: "upi" } } },
  });
  await handleRazorpayWebhook(w.db, mockNotifier, gateway, rawBody, "sig");
  assertEquals((await w.db.getBookingById(b.id))?.payment_status, "pending");
  const payment = await w.db.getPaymentByGatewayOrderId(order.razorpayOrderId);
  assertEquals(payment?.status, "failed");
});

Deno.test("webhook rejects an invalid signature", async () => {
  const w = makeWorld();
  const gateway = new MockRazorpayGateway();
  gateway.signatureValid = false;
  await assertRejects(
    () => handleRazorpayWebhook(w.db, mockNotifier, gateway, "{}", "bad-sig"),
    ApiError, "Invalid webhook signature",
  );
});
