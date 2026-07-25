# DriveMate Backend

Production-ready backend for **DriveMate** — a driver-booking app where the customer owns the car and books a professional driver. **COD-only MVP**, gateway-ready schema.

- **Compute:** Supabase Edge Functions (TypeScript / Deno)
- **Database:** Supabase Postgres + PostGIS
- **Realtime:** Supabase Realtime (subscribe to `driver_locations` / `bookings` changes)
- **Auth:** Firebase Phone OTP → exchanged for a self-issued HS256 backend JWT
- **Push:** Firebase Cloud Messaging (FCM HTTP v1, pure `fetch`, no Node SDK)
- **Payments:** Cash on Delivery only (Razorpay can be added later with **zero schema changes**)
- **Cost:** runs 100% on Supabase Free + Firebase Spark

---

## 1. Prerequisites

| Tool | Install |
|---|---|
| Deno ≥ 1.40 | `curl -fsSL https://deno.land/install.sh \| sh` |
| Supabase CLI | `npm i -g supabase` (or `brew install supabase/tap/supabase`) |
| Docker | needed by `supabase start` for local Postgres |
| A Firebase project | https://console.firebase.google.com (free Spark plan) |

## 2. Firebase setup (one time)

1. Create a Firebase project → note the **Project ID**.
2. **Authentication → Sign-in method → Phone → Enable.** Add test phone numbers under *Phone numbers for testing* for development (e.g. `+91 9999999999`, code `123456`).
3. **Project settings → Cloud Messaging** → make sure the *Firebase Cloud Messaging API (v1)* is enabled.
4. **Project settings → Service accounts → Generate new private key.** This downloads a JSON file. You will paste its **entire contents** into `FIREBASE_SERVICE_ACCOUNT_JSON` (single line — keep the `\n` in the private key exactly as-is in the JSON).

The mobile app (Expo, later) does the OTP flow with the Firebase client SDK and sends the resulting **Firebase ID token** to `POST /auth-session`.

## 3. Local development

```bash
git clone <this repo> && cd drivemate-backend
cp .env.example supabase/functions/.env      # fill in values (see below)

supabase start                               # local Postgres + APIs (Docker)
supabase db reset                            # applies all migrations + seed.sql
supabase functions serve --env-file supabase/functions/.env
```

`supabase start` prints your local `API URL`, `anon key` and `service_role key` — put them in the `.env` file:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase start`>
JWT_SECRET_KEY=<long random string, e.g. `openssl rand -hex 32`>
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FIREBASE_PROJECT_ID=<your firebase project id>
FIREBASE_SERVICE_ACCOUNT_JSON=<paste the whole service-account JSON on one line>
CORS_ORIGINS=*
PAYMENT_METHOD=cod
```

Functions are now at `http://127.0.0.1:54321/functions/v1/<name>`, e.g.:

```bash
curl http://127.0.0.1:54321/functions/v1/health
```

## 4. Running tests

Zero network needed — Firebase and the DB layer are fully mocked in-memory:

```bash
deno task test        # or: deno test --allow-env tests/
```

Covers: auth/JWT, booking creation + fare math, nearby search filters, the full booking state machine (incl. cancel/decline branches and invalid transitions), 403 authorization cases, driver location persistence, COD collection rules, review rules + rating recalculation, and earnings bucketing.

## 5. Deploying (hosting) — free tier

1. Create a project at https://supabase.com (Free plan).
2. Link & push the database:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push                       # applies ./supabase/migrations
   ```
3. Set secrets (server-side env vars):
   ```bash
   supabase secrets set JWT_SECRET_KEY=$(openssl rand -hex 32)
   supabase secrets set ACCESS_TOKEN_EXPIRE_MINUTES=1440
   supabase secrets set FIREBASE_PROJECT_ID=<project-id>
   supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
   supabase secrets set CORS_ORIGINS=*
   ```
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in deployed functions.)
4. Deploy all functions:
   ```bash
   supabase functions deploy --no-verify-jwt
   ```
   (`--no-verify-jwt` because we verify our **own** JWT inside each function; the platform gateway shouldn't also demand a Supabase Auth JWT.)
5. Your base URL is `https://<project-ref>.supabase.co/functions/v1/`.

## 6. API overview

Every response uses the envelope `{ "success": bool, "data": ..., "error": { "code", "message" } | null }`.
All protected endpoints need `Authorization: Bearer <accessToken>`.

| Endpoint | Method | Who | Purpose |
|---|---|---|---|
| `/health` | GET | public | liveness |
| `/auth-session` | POST | public | Firebase ID token → backend JWT |
| `/auth-me` | GET | any | current profile (+driver profile) |
| `/auth-refresh` | POST | any | new JWT |
| `/auth-logout` | POST | any | clears device FCM token |
| `/users-fcm-token` | POST | any | save push token |
| `/drivers-nearby` | GET | any | PostGIS radius search |
| `/drivers-profile` | PATCH | driver | create/update driver profile |
| `/drivers-availability` | POST | driver | toggle availability (verified only) |
| `/drivers-location` | POST | driver | GPS ping (lat/lng/heading/speed/accuracy) |
| `/drivers-earnings` | GET | driver | today/week/month/total |
| `/bookings-create` | POST | customer | create booking + payment row + push |
| `/bookings-get?bookingId=` | GET | parties | one booking |
| `/bookings-history` | GET | customer/driver | own bookings |
| `/bookings-accept` / `-decline` / `-arrived` / `-start` / `-complete` | POST | assigned driver | lifecycle |
| `/bookings-cancel` | POST | customer/admin | cancel before start |
| `/payments-mark-cod-collected` | POST | assigned driver/admin | confirm cash |
| `/payments-get-by-booking?bookingId=` | GET | parties | payment row |
| `/reviews-create` | POST | customer | 1–5 stars, one per booking |
| `/reviews-by-driver?driverId=` | GET | any | driver's reviews + avg |

**Booking state machine:** `pending → driver_accepted → arrived → started → completed`, with `cancelled` reachable from any pre-`started` state (customer/admin cancel, driver decline only before accept). Invalid transitions return **409**.

## 7. Example curl requests

```bash
BASE=http://127.0.0.1:54321/functions/v1

# 1) exchange Firebase ID token (from the app's OTP flow) for a backend JWT
curl -s $BASE/auth-session -H 'Content-Type: application/json' \
  -d '{"firebaseIdToken":"<FIREBASE_ID_TOKEN>","role":"customer"}'
# → { success, data: { accessToken, tokenType, user } }

TOKEN=<accessToken>
AUTH="Authorization: Bearer $TOKEN"

curl -s $BASE/auth-me -H "$AUTH"
curl -s $BASE/users-fcm-token -H "$AUTH" -H 'Content-Type: application/json' -d '{"fcmToken":"device-token"}'

# driver side
curl -s -X PATCH $BASE/drivers-profile -H "$DRIVER_AUTH" -H 'Content-Type: application/json' \
  -d '{"pricePerTrip":400,"licenseNumber":"UP78-DL-0001","experienceYears":3,"languages":["Hindi","English"],"serviceAirport":true}'
curl -s $BASE/drivers-availability -H "$DRIVER_AUTH" -H 'Content-Type: application/json' -d '{"isAvailable":true}'
curl -s $BASE/drivers-location -H "$DRIVER_AUTH" -H 'Content-Type: application/json' \
  -d '{"latitude":26.4499,"longitude":80.3319,"heading":90,"speed":0,"accuracy":5,"isOnline":true}'

# customer: search + book
curl -s "$BASE/drivers-nearby?latitude=26.4499&longitude=80.3319&radiusKm=10&serviceType=local" -H "$AUTH"
curl -s $BASE/bookings-create -H "$AUTH" -H 'Content-Type: application/json' -d '{
  "driverId":"<driverId>","serviceType":"local","routeType":"hourly",
  "pickupAddress":"Mall Road","pickupLatitude":26.4499,"pickupLongitude":80.3319,
  "dropAddress":"Airport","dropLatitude":26.47,"dropLongitude":80.35,
  "scheduledAt":"2026-07-10T12:00:00+05:30","vehicleNumber":"UP78AB1234","vehicleModel":"Swift"}'

# lifecycle (driver token)
curl -s $BASE/bookings-accept   -H "$DRIVER_AUTH" -d '{"bookingId":"<id>"}' -H 'Content-Type: application/json'
curl -s $BASE/bookings-arrived  -H "$DRIVER_AUTH" -d '{"bookingId":"<id>"}' -H 'Content-Type: application/json'
curl -s $BASE/bookings-start    -H "$DRIVER_AUTH" -d '{"bookingId":"<id>"}' -H 'Content-Type: application/json'
curl -s $BASE/bookings-complete -H "$DRIVER_AUTH" -d '{"bookingId":"<id>"}' -H 'Content-Type: application/json'
curl -s $BASE/payments-mark-cod-collected -H "$DRIVER_AUTH" -d '{"bookingId":"<id>"}' -H 'Content-Type: application/json'

# customer wraps up
curl -s "$BASE/payments-get-by-booking?bookingId=<id>" -H "$AUTH"
curl -s $BASE/reviews-create -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"bookingId":"<id>","rating":5,"comment":"Great drive"}'
curl -s "$BASE/reviews-by-driver?driverId=<driverId>" -H "$AUTH"
curl -s $BASE/drivers-earnings -H "$DRIVER_AUTH"
```

## 8. Realtime driver tracking (for the Expo app later)

Subscribe to Postgres changes with `@supabase/supabase-js` in the app:

```ts
supabase.channel("loc")
  .on("postgres_changes",
    { event: "UPDATE", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
    (payload) => updateMarker(payload.new))
  .subscribe();
```

(Enable Realtime for `driver_locations` and `bookings` in Dashboard → Database → Replication.)

## 9. Adding a payment gateway later

The `payments` table already has `method`, `gateway_order_id`, `gateway_payment_id`, `gateway_signature`. Add three new functions (`payments-create-order`, `payments-confirm`, `payments-webhook`), set `method='razorpay'` — **no migration needed**.

## 10. Architecture notes

- Business logic lives in `supabase/functions/_shared/*Service.ts` behind a small `Db` interface; edge functions are thin HTTP adapters. Tests inject an in-memory `Db` + mocked notifier/Firebase — `deno test` needs no network.
- Security layers: (1) JWT verification on every call, (2) role guards, (3) ownership checks in services, (4) Postgres RLS as defense-in-depth (`0012_rls_policies.sql`).
- `geo_point` is maintained by a DB trigger and indexed with GIST; nearby search is the `nearby_drivers()` SQL function using `ST_DWithin`, excluding stale (>2 min) locations.
