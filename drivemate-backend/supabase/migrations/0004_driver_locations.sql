create table if not exists driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers(id) on delete cascade unique,
  latitude double precision,
  longitude double precision,
  geo_point geography(Point,4326),
  heading numeric,
  speed numeric,
  accuracy numeric,
  is_online boolean default false,
  updated_at timestamptz default now()
);

-- keep geo_point in sync with lat/lng automatically
create or replace function sync_geo_point() returns trigger as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geo_point = ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  end if;
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_driver_locations_geo before insert or update on driver_locations
for each row execute function sync_geo_point();

create index if not exists idx_driver_locations_geo on driver_locations using gist (geo_point);
