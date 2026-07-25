create table if not exists booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  event_type text,
  old_status text,
  new_status text,
  created_by uuid references users(id),
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_booking_events_booking on booking_events(booking_id, created_at);
