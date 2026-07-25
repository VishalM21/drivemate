-- COD-first, gateway-ready payments table.
-- Adding Razorpay later requires ZERO schema changes:
-- method='razorpay', gateway_order_id/payment_id/signature get populated,
-- status flows pending -> (gateway confirm) instead of cod_due -> cod_collected.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  amount numeric(10,2),
  currency text default 'INR',
  method text default 'cod',
  gateway_order_id text,
  gateway_payment_id text,
  gateway_signature text,
  status text check (status in ('pending','cod_due','cod_collected','failed','refunded')) default 'cod_due',
  collected_by uuid references users(id),
  collected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_payments_booking on payments(booking_id);

create trigger trg_payments_updated_at before update on payments
for each row execute function set_updated_at();
