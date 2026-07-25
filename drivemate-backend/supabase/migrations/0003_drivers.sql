create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  rating numeric(2,1) default 0,
  total_trips int default 0,
  experience_years int default 0,
  languages text[] default '{}',
  price_per_trip numeric(10,2) not null,
  is_verified boolean default false,
  is_available boolean default false,
  service_local boolean default true,
  service_outstation boolean default false,
  service_airport boolean default false,
  service_monthly boolean default false,
  service_night boolean default false,
  license_number text not null,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_drivers_user_id on drivers(user_id);
create index if not exists idx_drivers_available on drivers(is_available) where is_available = true;

create trigger trg_drivers_updated_at before update on drivers
for each row execute function set_updated_at();
