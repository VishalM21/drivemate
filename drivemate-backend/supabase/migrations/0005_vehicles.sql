create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references users(id) on delete cascade,
  vehicle_number text not null,
  vehicle_model text,
  vehicle_type text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (customer_id, vehicle_number)
);

create index if not exists idx_vehicles_customer on vehicles(customer_id);

create trigger trg_vehicles_updated_at before update on vehicles
for each row execute function set_updated_at();
