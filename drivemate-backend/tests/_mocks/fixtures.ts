import { MemoryDb, asAuth } from "./memoryDb.ts";
import type { UserRow, DriverRow } from "../../supabase/functions/_shared/types.ts";

export interface World {
  db: MemoryDb;
  customer: UserRow;
  driverUser: UserRow;
  driver: DriverRow;
  otherDriverUser: UserRow;
  otherDriver: DriverRow;
  otherCustomer: UserRow;
  admin: UserRow;
}

export function makeWorld(): World {
  const db = new MemoryDb();
  const customer = db.seedUser({ role: "customer", full_name: "Test Customer" });
  const otherCustomer = db.seedUser({ role: "customer", full_name: "Other Customer" });
  const driverUser = db.seedUser({ role: "driver", full_name: "Ravi Kumar" });
  const otherDriverUser = db.seedUser({ role: "driver", full_name: "Other Driver" });
  const admin = db.seedUser({ role: "admin", full_name: "Admin" });
  const driver = db.seedDriver({ user_id: driverUser.id, price_per_trip: 400, service_airport: true, service_outstation: true });
  const otherDriver = db.seedDriver({ user_id: otherDriverUser.id, price_per_trip: 500 });
  db.seedLocation({ driver_id: driver.id, latitude: 26.4499, longitude: 80.3319 });
  db.seedLocation({ driver_id: otherDriver.id, latitude: 26.46, longitude: 80.34 });
  return { db, customer, driverUser, driver, otherDriverUser, otherDriver, otherCustomer, admin };
}

export { asAuth };
