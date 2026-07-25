// Function names match the deployed Supabase Edge Function folders exactly —
// see drivemate-backend/supabase/functions/*. Never invent a name here.
export const ENDPOINTS = {
  health: 'health',

  authSession: 'auth-session',
  authMe: 'auth-me',
  authRefresh: 'auth-refresh',
  authLogout: 'auth-logout',

  usersFcmToken: 'users-fcm-token',
  usersProfile: 'users-profile',
  vehiclesUpsert: 'vehicles-upsert',

  driversNearby: 'drivers-nearby',
  driversProfile: 'drivers-profile',
  driversAvailability: 'drivers-availability',
  driversLocation: 'drivers-location',
  driversEarnings: 'drivers-earnings',

  bookingsCreate: 'bookings-create',
  bookingsGet: 'bookings-get',
  bookingsHistory: 'bookings-history',
  bookingsAccept: 'bookings-accept',
  bookingsDecline: 'bookings-decline',
  bookingsArrived: 'bookings-arrived',
  bookingsStart: 'bookings-start',
  bookingsComplete: 'bookings-complete',
  bookingsCancel: 'bookings-cancel',

  paymentsMarkCodCollected: 'payments-mark-cod-collected',
  paymentsGetByBooking: 'payments-get-by-booking',
  paymentsCreateOrder: 'payments-create-order',
  paymentsVerify: 'payments-verify',

  reviewsCreate: 'reviews-create',
  reviewsByDriver: 'reviews-by-driver',
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;
