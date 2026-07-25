create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text unique not null,
  customer_id uuid references users(id),
  driver_id uuid references drivers(id),
  vehicle_id uuid references vehicles(id),
  service_type text check (service_type in ('local','outstation','airport','monthly')),
  route_type text check (route_type in ('one_way','round_trip','hourly')),
  pickup_address text,
  pickup_latitude double precision,
  pickup_longitude double precision,
  drop_address text,
  drop_latitude double precision,
  drop_longitude double precision,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  status text check (status in ('pending','driver_notified','driver_accepted','driver_arriving','arrived','started','completed','cancelled','expired')) default 'pending',
  driver_fee numeric(10,2),
  platform_fee numeric(10,2),
  tax_amount numeric(10,2),
  total_amount numeric(10,2),
  payment_status text check (payment_status in ('pending','cod_due','cod_collected','failed','refunded')) default 'pending',
  payment_method text default 'cod',
  cancellation_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_bookings_customer on bookings(customer_id, created_at desc);
create index if not exists idx_bookings_driver on bookings(driver_id, created_at desc);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_bookings_completed_at on bookings(completed_at);

create trigger trg_bookings_updated_at before update on bookings
for each row execute function set_updated_at();
