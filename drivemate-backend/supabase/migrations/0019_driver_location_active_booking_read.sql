-- The existing driver_locations_read policy only allows reading a driver's
-- location while is_available = true (for browsing before booking) — but a
-- driver's is_available flips to false the moment they accept a booking
-- (busy-on-trip lock), which silently cut off the customer's live tracking
-- for the exact window they need it: driver en route to pickup / on trip.
--
-- Multiple permissive RLS policies for the same command are OR'd together,
-- so this is purely additive: a customer can now also read their assigned
-- driver's location for any of their own non-terminal bookings, regardless
-- of that driver's availability flag.
create policy driver_locations_active_booking on driver_locations for select
  using (
    driver_id in (
      select driver_id from bookings
      where customer_id = app_current_user_id()
        and driver_id is not null
        and status not in ('completed', 'cancelled', 'expired')
    )
  );
