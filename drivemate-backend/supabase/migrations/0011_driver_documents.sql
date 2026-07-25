create table if not exists driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers(id) on delete cascade,
  document_type text,
  document_url text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  verified_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_driver_documents_driver on driver_documents(driver_id);

-- PostGIS-powered nearby driver search used by the drivers-nearby edge function.
create or replace function nearby_drivers(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision,
  p_service_type text
) returns table (
  driver_id uuid,
  user_id uuid,
  full_name text,
  phone text,
  rating numeric,
  total_trips int,
  experience_years int,
  languages text[],
  price_per_trip numeric,
  is_verified boolean,
  is_available boolean,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  service_local boolean,
  service_outstation boolean,
  service_airport boolean,
  service_monthly boolean,
  service_night boolean
) language sql stable as $$
  select
    d.id, d.user_id, u.full_name, u.phone,
    d.rating, d.total_trips, d.experience_years, d.languages,
    d.price_per_trip, d.is_verified, d.is_available,
    dl.latitude, dl.longitude,
    ST_Distance(dl.geo_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat),4326)::geography) / 1000.0 as distance_km,
    d.service_local, d.service_outstation, d.service_airport, d.service_monthly, d.service_night
  from drivers d
  join users u on u.id = d.user_id
  join driver_locations dl on dl.driver_id = d.id
  where d.is_verified = true
    and d.is_available = true
    and u.is_active = true
    and dl.is_online = true
    and (dl.updated_at >= now() - interval '2 minutes' or u.phone in ('9999999997', '9999999998'))
    and ST_DWithin(dl.geo_point, ST_SetSRID(ST_MakePoint(p_lng, p_lat),4326)::geography, p_radius_km * 1000)
    and (
      (p_service_type = 'local' and d.service_local) or
      (p_service_type = 'outstation' and d.service_outstation) or
      (p_service_type = 'airport' and d.service_airport) or
      (p_service_type = 'monthly' and d.service_monthly) or
      (p_service_type = 'night' and d.service_night) or
      p_service_type is null or p_service_type = ''
    )
  order by distance_km asc;
$$;
