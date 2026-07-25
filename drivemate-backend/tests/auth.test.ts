import { assertEquals, assertRejects } from "./_mocks/assert.ts";
import { MemoryDb, asAuth } from "./_mocks/memoryDb.ts";
import { createSession, me, refreshSession, saveFcmToken, logout } from "../supabase/functions/_shared/authService.ts";
import { verifyJwt } from "../supabase/functions/_shared/jwt.ts";
import { ApiError } from "../supabase/functions/_shared/errors.ts";

const SECRET = "test-secret";
// Mocked Firebase ID token verification — no network.
const mockVerify = (uid: string, phone: string) => async (_t: string) => ({ uid, phone });

Deno.test("auth-session creates a new user and returns a valid backend JWT", async () => {
  const db = new MemoryDb();
  const deps = { db, verifyIdToken: mockVerify("fb-123", "9876543210"), jwtSecret: SECRET, expireMinutes: 60 };
  const res = await createSession(deps, { firebaseIdToken: "fake", role: "customer" }) as any;

  assertEquals(res.tokenType, "bearer");
  assertEquals(res.user.phone, "9876543210");
  assertEquals(res.user.role, "customer");
  const claims = await verifyJwt(res.accessToken, SECRET);
  assertEquals(claims.sub, res.user.id);
  assertEquals(claims.role, "customer");
});

Deno.test("auth-session reuses existing user and rejects role switching", async () => {
  const db = new MemoryDb();
  const deps = { db, verifyIdToken: mockVerify("fb-123", "9876543210"), jwtSecret: SECRET, expireMinutes: 60 };
  const first = await createSession(deps, { firebaseIdToken: "fake", role: "driver" }) as any;
  const second = await createSession(deps, { firebaseIdToken: "fake", role: "driver" }) as any;
  assertEquals(first.user.id, second.user.id);
  assertEquals(db.users.length, 1);

  await assertRejects(
    () => createSession(deps, { firebaseIdToken: "fake", role: "customer" }),
    ApiError, "registered as 'driver'",
  );
});

Deno.test("auth-session validates input", async () => {
  const db = new MemoryDb();
  const deps = { db, verifyIdToken: mockVerify("x", "1"), jwtSecret: SECRET, expireMinutes: 60 };
  await assertRejects(() => createSession(deps, { role: "customer" } as any), ApiError, "firebaseIdToken");
  await assertRejects(() => createSession(deps, { firebaseIdToken: "t", role: "superuser" } as any), ApiError, "role");
});

Deno.test("expired/invalid JWTs are rejected", async () => {
  const db = new MemoryDb();
  const deps = { db, verifyIdToken: mockVerify("fb-1", "9000000000"), jwtSecret: SECRET, expireMinutes: -1 };
  const res = await createSession(deps, { firebaseIdToken: "fake", role: "customer" }) as any;
  await assertRejects(() => verifyJwt(res.accessToken, SECRET), ApiError, "expired");
  await assertRejects(() => verifyJwt(res.accessToken + "x", SECRET), ApiError);
  await assertRejects(() => verifyJwt("not.a.jwt", SECRET), ApiError);
});

Deno.test("auth-me / refresh / fcm-token / logout round trip", async () => {
  const db = new MemoryDb();
  const user = db.seedUser({ role: "customer" });
  const auth = asAuth(user);

  const profile = await me(db, auth);
  assertEquals((profile as any).id, user.id);

  const deps = { db, verifyIdToken: mockVerify("x", "1"), jwtSecret: SECRET, expireMinutes: 60 };
  const refreshed = await refreshSession(deps, auth);
  const claims = await verifyJwt(refreshed.accessToken, SECRET);
  assertEquals(claims.sub, user.id);

  await saveFcmToken(db, auth, { fcmToken: "new-device-token" });
  assertEquals(db.users[0].fcm_token, "new-device-token");

  await logout(db, auth);
  assertEquals(db.users[0].fcm_token, null);
});

Deno.test("auth-session onboarding flow: returns isNewUser, then registers", async () => {
  const db = new MemoryDb();
  const deps = { db, verifyIdToken: mockVerify("fb-999", "9999999999"), jwtSecret: SECRET, expireMinutes: 60 };
  
  // 1. Initial hit without role -> isNewUser: true
  const res1 = await createSession(deps, { firebaseIdToken: "fake" });
  assertEquals((res1 as any).isNewUser, true);
  assertEquals((res1 as any).phone, "9999999999");
  
  // 2. Secondary hit with role & fullName -> completes onboarding
  const res2 = await createSession(deps, { firebaseIdToken: "fake", role: "customer", fullName: "New Cust" }) as any;
  assertEquals(res2.user.role, "customer");
  assertEquals(res2.user.fullName, "New Cust");
  
  // 3. Third hit without role -> logs in directly using stored role
  const res3 = await createSession(deps, { firebaseIdToken: "fake" }) as any;
  assertEquals(res3.user.role, "customer");
  assertEquals(res3.user.fullName, "New Cust");
});
