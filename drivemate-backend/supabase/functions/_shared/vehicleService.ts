import type { Db } from "./db.ts";
import type { AuthUser } from "./roleGuards.ts";
import { badRequest, forbidden } from "./errors.ts";
import { vehicleToApi } from "./mappers.ts";

export async function upsertDefaultVehicle(
  db: Db,
  auth: AuthUser,
  body: { vehicleNumber?: string; vehicleModel?: string },
) {
  if (auth.role !== "customer") throw forbidden("Only customers have a default vehicle");
  const { vehicleNumber, vehicleModel } = body ?? {};
  if (!vehicleNumber?.trim()) throw badRequest("vehicleNumber is required");

  const vehicle = await db.upsertVehicle(
    auth.id,
    vehicleNumber.toUpperCase().replace(/\s+/g, ""),
    vehicleModel?.trim() || null,
    true,
  );
  return vehicleToApi(vehicle);
}
