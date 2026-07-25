// DriveMate Ride Lifecycle Simulator
// Runs locally using Deno and the Supabase CLI to update booking states.

async function runQuery(sql: string): Promise<any[]> {
  const command = new Deno.Command("supabase", {
    args: ["db", "query", "--output-format", "json", sql],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  const errText = new TextDecoder().decode(stderr).trim();
  if (code !== 0) {
    throw new Error(`SQL Error: ${errText}`);
  }
  const outText = new TextDecoder().decode(stdout).trim();
  try {
    const data = JSON.parse(outText);
    return data.rows || [];
  } catch (_e) {
    return [];
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("====================================================");
console.log("🚗 DriveMate Ride Lifecycle Simulator");
console.log("====================================================");
console.log("This script will poll for a 'pending' booking request,");
console.log("assign Seed Driver 1 (+91 9999999997), and advance");
console.log("the status in real-time so you can watch the frontend");
console.log("transition automatically.");
console.log("====================================================\n");

// 1. Fetch driver details
console.log("🔍 Fetching Seed Driver 1 details...");
let driver: any = null;
try {
  const drivers = await runQuery(`
    SELECT d.id as driver_id, d.user_id as driver_user_id, u.full_name 
    FROM drivers d 
    JOIN users u ON d.user_id = u.id 
    WHERE u.phone = '+91 9999999997' 
    LIMIT 1
  `);
  if (drivers.length === 0) {
    console.error("❌ Seed Driver 1 not found in database. Did you run the database migrations and seed?");
    Deno.exit(1);
  }
  driver = drivers[0];
  console.log(`✅ Found Driver: ${driver.full_name} (ID: ${driver.driver_id})\n`);
} catch (e: any) {
  console.error("❌ Failed to query database:", e.message);
  Deno.exit(1);
}

// 2. Poll for pending bookings
console.log("⏳ Waiting for a booking request from the customer app...");
let booking: any = null;

while (true) {
  try {
    const bookings = await runQuery(`
      SELECT b.id, b.booking_number, b.total_amount, b.pickup_address, b.drop_address, b.customer_id, u.ride_otp 
      FROM bookings b 
      JOIN users u ON b.customer_id = u.id 
      WHERE b.status = 'pending' 
      ORDER BY b.created_at DESC 
      LIMIT 1
    `);
    if (bookings.length > 0) {
      booking = bookings[0];
      break;
    }
  } catch (e: any) {
    console.error("❌ Error polling bookings:", e.message);
    Deno.exit(1);
  }
  await sleep(2000);
}

console.log("\n🚨 NEW BOOKING REQUEST DETECTED!");
console.log("----------------------------------------------------");
console.log(`Booking Number : ${booking.booking_number}`);
console.log(`Pickup Location: ${booking.pickup_address || "Not specified"}`);
console.log(`Drop-off Location: ${booking.drop_address || "Not specified"}`);
console.log(`Fare Total     : ₹${booking.total_amount}`);
console.log(`Ride OTP       : ${booking.ride_otp || "1234"}`);
console.log("----------------------------------------------------\n");

await sleep(2000);

// 3. Driver Accepts the Ride
console.log("👉 Step 1: Driver accepts the booking...");
await runQuery(`
  UPDATE bookings 
  SET status = 'driver_accepted', driver_id = '${driver.driver_id}', updated_at = now() 
  WHERE id = '${booking.id}'
`);
await runQuery(`
  UPDATE drivers 
  SET is_available = false 
  WHERE id = '${driver.driver_id}'
`);
await runQuery(`
  INSERT INTO booking_events (booking_id, event_type, old_status, new_status, created_by) 
  VALUES ('${booking.id}', 'accepted', 'pending', 'driver_accepted', '${driver.driver_user_id}')
`);
console.log("✅ Booking status set to 'driver_accepted'.");
console.log("📱 Check your app: The status should update to 'Driver Confirmed'.\n");

await sleep(5000);

// 4. Driver Arrives at Pickup Location
console.log("👉 Step 2: Driver marks as arrived at pickup location...");
await runQuery(`
  UPDATE bookings 
  SET status = 'arrived', updated_at = now() 
  WHERE id = '${booking.id}'
`);
await runQuery(`
  INSERT INTO booking_events (booking_id, event_type, old_status, new_status, created_by) 
  VALUES ('${booking.id}', 'arrived', 'driver_accepted', 'arrived', '${driver.driver_user_id}')
`);
console.log("✅ Booking status set to 'arrived'.");
console.log("📱 Check your app: The status should update to 'Driver Arrived'.\n");

await sleep(5000);

// 5. Driver Starts the Trip (Requires OTP)
console.log(`👉 Step 3: Starting trip using OTP: ${booking.ride_otp || "1234"}...`);
await runQuery(`
  UPDATE bookings 
  SET status = 'started', started_at = now(), updated_at = now() 
  WHERE id = '${booking.id}'
`);
await runQuery(`
  INSERT INTO booking_events (booking_id, event_type, old_status, new_status, created_by) 
  VALUES ('${booking.id}', 'started', 'arrived', 'started', '${driver.driver_user_id}')
`);
console.log("✅ Booking status set to 'started'.");
console.log("📱 Check your app: The status should update to 'In Trip'.\n");

console.log("🚗 Trip in progress... simulating 8 seconds of driving...");
await sleep(8000);

// 6. Driver Completes the Trip
console.log("👉 Step 4: Driver completes the trip...");
await runQuery(`
  UPDATE bookings 
  SET status = 'completed', completed_at = now(), payment_status = 'pending', updated_at = now()
  WHERE id = '${booking.id}'
`);
await runQuery(`
  UPDATE drivers 
  SET is_available = true, total_trips = total_trips + 1 
  WHERE id = '${driver.driver_id}'
`);
await runQuery(`
  INSERT INTO booking_events (booking_id, event_type, old_status, new_status, created_by) 
  VALUES ('${booking.id}', 'completed', 'started', 'completed', '${driver.driver_user_id}')
`);
console.log("✅ Booking status set to 'completed'.");
console.log("📱 Check your app: The status should update to 'Completed' and show the rating/review option.\n");

await sleep(5000);

// 7. Collect Payment (COD)
console.log(`👉 Step 5: Collecting Cash Payment of ₹${booking.total_amount}...`);
await runQuery(`
  UPDATE payments 
  SET status = 'paid', collected_by = '${driver.driver_user_id}', collected_at = now(), updated_at = now()
  WHERE booking_id = '${booking.id}'
`);
await runQuery(`
  UPDATE bookings 
  SET payment_status = 'paid', updated_at = now()
  WHERE id = '${booking.id}'
`);
console.log("✅ Payment status set to 'paid'.");
console.log("🎉 Ride simulation successfully completed!");
Deno.exit(0);
