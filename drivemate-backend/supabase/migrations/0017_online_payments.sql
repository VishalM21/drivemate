-- Generalizes payment status from COD-specific values to method-agnostic
-- ones, so online (Razorpay) payments and COD share the same state machine:
-- 'pending' (awaiting payment) -> 'paid' (settled, by either method) | 'failed'.
-- `payments.method` (cod|card|upi|netbanking|wallet) records how; the
-- gateway_order_id/gateway_payment_id/gateway_signature columns already
-- existed (added gateway-ready from day one), so no new columns are needed.

update bookings set payment_status = 'paid' where payment_status = 'cod_collected';
update bookings set payment_status = 'pending' where payment_status = 'cod_due';

update payments set status = 'paid' where status = 'cod_collected';
update payments set status = 'pending' where status = 'cod_due';

alter table bookings drop constraint if exists bookings_payment_status_check;
alter table bookings add constraint bookings_payment_status_check
  check (payment_status in ('pending','paid','failed','refunded'));

alter table payments drop constraint if exists payments_status_check;
alter table payments add constraint payments_status_check
  check (status in ('pending','paid','failed','refunded'));

alter table payments alter column status set default 'pending';
