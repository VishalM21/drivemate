create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) unique,
  customer_id uuid references users(id),
  driver_id uuid references drivers(id),
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create index if not exists idx_reviews_driver on reviews(driver_id, created_at desc);
