import { assertEquals } from "./_mocks/assert.ts";
import { makeWorld, asAuth } from "./_mocks/fixtures.ts";
import { earnings } from "../supabase/functions/_shared/driverService.ts";

function seedCompleted(w: ReturnType<typeof makeWorld>, fee: number, completedAt: Date, paymentStatus = "paid", status = "completed") {
  w.db.bookings.push({
    id: crypto.randomUUID(), booking_number: `DM-${Math.random()}`,
    customer_id: w.customer.id, driver_id: w.driver.id, vehicle_id: null,
    service_type: "local", route_type: null,
    pickup_address: null, pickup_latitude: null, pickup_longitude: null,
    drop_address: null, drop_latitude: null, drop_longitude: null,
    scheduled_at: null, started_at: null, completed_at: completedAt.toISOString(), cancelled_at: null,
    status, driver_fee: fee, platform_fee: fee * 0.1, tax_amount: fee * 0.018, total_amount: fee * 1.118,
    payment_status: paymentStatus, payment_method: "cod", cancellation_reason: null,
    created_at: completedAt.toISOString(), updated_at: completedAt.toISOString(),
  } as any);
}

Deno.test("earnings buckets: today / week / month / total, only completed+paid", async () => {
  const w = makeWorld();
  // Fixed reference: Wed 15 July 2026 12:00 local
  const nowRef = new Date(2026, 6, 15, 12, 0, 0);
  const daysAgo = (n: number) => new Date(nowRef.getTime() - n * 24 * 3600 * 1000);

  seedCompleted(w, 400, new Date(2026, 6, 15, 9, 0));   // today
  seedCompleted(w, 400, new Date(2026, 6, 14, 18, 0));  // yesterday (this week: Mon 13 Jul)
  seedCompleted(w, 500, new Date(2026, 6, 13, 8, 0));   // Monday, this week
  seedCompleted(w, 700, new Date(2026, 6, 5, 8, 0));    // this month, previous week
  seedCompleted(w, 1000, new Date(2026, 4, 1, 8, 0));   // May — total only
  // Excluded rows:
  seedCompleted(w, 9999, daysAgo(0), "pending");                 // completed but payment not settled
  seedCompleted(w, 9999, daysAgo(0), "paid", "started");         // not completed status

  const e = await earnings(w.db, asAuth(w.driverUser), nowRef);
  assertEquals(e.today, 400);
  assertEquals(e.week, 1300);   // 400 + 400 + 500
  assertEquals(e.month, 2000);  // + 700
  assertEquals(e.total, 3000);  // + 1000
  assertEquals(e.totalTrips, 5);
  assertEquals(e.averagePerTrip, 600);
});

Deno.test("earnings are zero for a driver with no collected trips", async () => {
  const w = makeWorld();
  const e = await earnings(w.db, asAuth(w.driverUser));
  assertEquals(e, { today: 0, week: 0, month: 0, total: 0, totalTrips: 0, averagePerTrip: 0 });
});
