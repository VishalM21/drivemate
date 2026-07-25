import type { Db } from "./db.ts";
import type { AuthUser } from "./roleGuards.ts";
import { badRequest, conflict, forbidden, notFound } from "./errors.ts";
import { reviewToApi } from "./mappers.ts";

export async function createReview(
  db: Db,
  auth: AuthUser,
  body: { bookingId?: string; rating?: number; comment?: string },
) {
  const { bookingId, rating, comment } = body ?? {};
  if (!bookingId) throw badRequest("bookingId is required");
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badRequest("rating must be an integer between 1 and 5");
  }

  const booking = await db.getBookingById(bookingId);
  if (!booking) throw notFound("Booking not found");
  if (booking.status !== "completed") throw conflict("You can only review completed trips");

  const reviewerRole = auth.role;
  if (reviewerRole !== "customer" && reviewerRole !== "driver") {
    throw forbidden("Only customers and drivers can leave reviews");
  }

  // Check booking association based on role
  if (reviewerRole === "customer") {
    if (booking.customer_id !== auth.id) throw forbidden("Not your booking");
  } else {
    // Driver
    const driver = await db.getDriverByUserId(auth.id);
    if (!driver || booking.driver_id !== driver.id) throw forbidden("Booking is not assigned to you");
  }

  // Ensure reviewer hasn't already reviewed this booking
  const existing = await db.getReviewByBookingAndRole(bookingId, reviewerRole);
  if (existing) throw conflict(`You have already reviewed this booking as a ${reviewerRole}`);

  const review = await db.insertReview({
    booking_id: bookingId,
    customer_id: booking.customer_id,
    driver_id: booking.driver_id,
    rating,
    comment: comment ?? null,
    reviewer_role: reviewerRole,
  });

  if (reviewerRole === "customer") {
    // Customer reviewed driver -> recalculate driver's rating
    const all = await db.listReviewsByDriver(booking.driver_id);
    const customerReviews = all.filter(r => r.reviewer_role === "customer");
    if (customerReviews.length > 0) {
      const avg = customerReviews.reduce((s, r) => s + r.rating, 0) / customerReviews.length;
      await db.updateDriver(booking.driver_id, { rating: Math.round(avg * 10) / 10 });
    }
  } else {
    // Driver reviewed customer -> recalculate customer's rating
    const all = await db.listReviewsByCustomer(booking.customer_id);
    const driverReviews = all.filter(r => r.reviewer_role === "driver");
    if (driverReviews.length > 0) {
      const avg = driverReviews.reduce((s, r) => s + r.rating, 0) / driverReviews.length;
      await db.updateUser(booking.customer_id, {
        rating_as_customer: Math.round(avg * 10) / 10,
        total_trips_as_customer: driverReviews.length,
      });
    }
  }

  return reviewToApi(review);
}

export async function reviewsByDriver(db: Db, driverId?: string | null) {
  if (!driverId) throw badRequest("driverId is required");
  const driver = await db.getDriverById(driverId);
  if (!driver) throw notFound("Driver not found");
  const reviews = await db.listReviewsByDriver(driverId);
  const customerReviews = reviews.filter((r) => r.reviewer_role === "customer");
  return {
    driverId,
    rating: Number(driver.rating),
    count: customerReviews.length,
    reviews: customerReviews.map(reviewToApi),
  };
}
