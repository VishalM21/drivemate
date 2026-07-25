import type { Db } from "./db.ts";
import { signJwt } from "./jwt.ts";
import { badRequest, forbidden } from "./errors.ts";
import { userToApi } from "./mappers.ts";
import type { FirebaseTokenPayload } from "./firebaseAdmin.ts";
import type { AuthUser } from "./roleGuards.ts";
import type { UserRow } from "./types.ts";

export interface AuthDeps {
  db: Db;
  verifyIdToken: (idToken: string) => Promise<FirebaseTokenPayload>;
  jwtSecret: string;
  expireMinutes: number;
}

const ROLES = ["customer", "driver", "admin"];

export async function createSession(
  deps: AuthDeps,
  body: {
    firebaseIdToken?: string;
    role?: string;
    fullName?: string;
    aadharNumber?: string;
    rcNumber?: string;
    carNumber?: string;
    dlNumber?: string;
    dob?: string;
    carName?: string;
    carRcName?: string;
  },
) {
  const { firebaseIdToken, role, fullName, aadharNumber, rcNumber, carNumber, dlNumber, dob, carName, carRcName } = body ?? {};
  if (!firebaseIdToken) throw badRequest("firebaseIdToken is required");

  const fb = await deps.verifyIdToken(firebaseIdToken);
  if (!fb.phone) throw badRequest("Firebase token has no phone number");

  let user = await deps.db.getUserByFirebaseUid(fb.uid);
  if (!user) {
    const existing = await deps.db.getUserByPhone(fb.phone);
    if (existing) {
      // Sync the new Firebase UID
      user = await deps.db.updateUser(existing.id, { firebase_uid: fb.uid });
    } else {
      // If user does not exist and no role is supplied, they must onboard
      if (!role) {
        return { isNewUser: true, firebaseUid: fb.uid, phone: fb.phone };
      }
      
      if (!ROLES.includes(role)) {
        throw badRequest("role must be one of customer|driver|admin");
      }
      
      user = await deps.db.createUser({
        firebase_uid: fb.uid,
        phone: fb.phone,
        role,
        full_name: fullName ?? null,
        aadhar_number: aadharNumber ?? null,
        rc_number: rcNumber ?? null,
        car_number: carNumber ?? null,
        dl_number: dlNumber ?? null,
        dob: dob ?? null,
        car_name: carName ?? null,
        car_rc_name: carRcName ?? null,
        is_active: true,
        ride_otp: role === "customer" ? Math.floor(1000 + Math.random() * 9000).toString() : null,
      });

      if (role === "driver") {
        // Automatically create driver profile record to make driver functional immediately
        const driverProfile = await deps.db.createDriver({
          user_id: user.id,
          license_number: dlNumber ?? "DL-PENDING",
          price_per_trip: 100, // default price
          is_verified: true, // auto-verified for onboarding ease
          is_available: true,
          service_local: true,
          service_outstation: true,
          service_airport: true,
        });
        // Seed driver location as offline initially
        await deps.db.upsertDriverLocation({
          driver_id: driverProfile.id,
          latitude: 26.4499,
          longitude: 80.3319,
          is_online: false,
        });
      }
    }
  } else {
    // If the user exists and role is supplied, verify it doesn't conflict
    if (role && user.role !== role) {
      throw forbidden(`Account is registered as '${user.role}', not '${role}'`);
    }
  }
  
  if (!user.is_active) throw forbidden("Account is deactivated");

  const accessToken = await signJwt(
    { sub: user.id, role: user.role, phone: user.phone },
    deps.jwtSecret,
    deps.expireMinutes,
  );
  return { accessToken, tokenType: "bearer", user: userToApi(user) };
}

export async function updateUserProfile(
  db: Db,
  auth: AuthUser,
  body: {
    fullName?: string;
    email?: string;
    dob?: string;
    carName?: string;
    carRcName?: string;
  },
) {
  const user = await db.getUserById(auth.id);
  if (!user) throw forbidden("User not found");

  if (user.role === "driver") {
    // Driver can't change Name, DOB, Aadhar, DL details
    if ((body.fullName !== undefined && body.fullName !== user.full_name) ||
        (body.dob !== undefined && body.dob !== user.dob)) {
      throw forbidden("Drivers cannot change registration details (Name, DOB)");
    }
    throw forbidden("Drivers cannot edit their profile");
  }

  // Customer can change car details, name, and email whenever they want
  const patch: Partial<UserRow> = {};
  if (body.carName !== undefined) patch.car_name = body.carName;
  if (body.carRcName !== undefined) patch.car_rc_name = body.carRcName;
  if (body.fullName !== undefined) patch.full_name = body.fullName;
  if (body.email !== undefined) patch.email = body.email;
  if (body.dob !== undefined) patch.dob = body.dob;

  const updated = await db.updateUser(auth.id, patch);
  return userToApi(updated);
}

export async function refreshSession(deps: AuthDeps, auth: AuthUser) {
  const user = await deps.db.getUserById(auth.id);
  if (!user || !user.is_active) throw forbidden("Account is deactivated");
  const accessToken = await signJwt(
    { sub: user.id, role: user.role, phone: user.phone },
    deps.jwtSecret,
    deps.expireMinutes,
  );
  return { accessToken, tokenType: "bearer", user: userToApi(user) };
}

export async function me(db: Db, auth: AuthUser) {
  const user = await db.getUserById(auth.id);
  if (!user) throw forbidden("User not found");
  const result: Record<string, unknown> = userToApi(user);
  if (user.role === "driver") {
    const driver = await db.getDriverByUserId(user.id);
    if (driver) result.driverProfile = (await import("./mappers.ts")).driverToApi(driver);
  }
  if (user.role === "customer") {
    const defaultVehicle = await db.getDefaultVehicle(user.id);
    if (defaultVehicle) result.defaultVehicle = (await import("./mappers.ts")).vehicleToApi(defaultVehicle);
  }
  return result;
}

export async function logout(db: Db, auth: AuthUser) {
  // Soft logout: clear FCM token so this device stops receiving pushes.
  await db.updateUser(auth.id, { fcm_token: null });
  return { loggedOut: true };
}

export async function saveFcmToken(db: Db, auth: AuthUser, body: { fcmToken?: string }) {
  if (!body?.fcmToken) throw badRequest("fcmToken is required");
  await db.updateUser(auth.id, { fcm_token: body.fcmToken });
  return { saved: true };
}
