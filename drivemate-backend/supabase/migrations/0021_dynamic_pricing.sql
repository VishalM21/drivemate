-- Dynamic (surge) pricing: drivers no longer set their own price — base
-- rates + a real-time supply/demand multiplier live in application code
-- (_shared/fareCalculator.ts + _shared/dynamicPricing.ts). The column stays
-- (avoids a destructive drop) but is no longer required or read.
alter table drivers alter column price_per_trip drop not null;
alter table drivers alter column price_per_trip set default 0;

-- Records what multiplier a booking was actually priced at, for transparency
-- (shown to the customer) and so a completed trip's fare is auditable after
-- the fact even as live surge conditions keep changing.
alter table bookings add column if not exists surge_multiplier numeric(3,2) not null default 1.0;

-- Demand side of the surge ratio: open (not yet accepted) ride requests
-- whose pickup point is within radius_km of the given point. Mirrors
-- nearby_drivers()'s distance-query shape for consistency.
create or replace function nearby_pending_bookings_count(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision
) returns integer language sql stable as $$
  select count(*)::int
  from bookings
  where status in ('pending', 'driver_notified')
    and pickup_latitude is not null
    and pickup_longitude is not null
    and ST_DWithin(
      ST_SetSRID(ST_MakePoint(pickup_longitude, pickup_latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000
    )
$$;
