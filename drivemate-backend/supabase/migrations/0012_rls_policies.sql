-- Defense in depth. Edge Functions use the service-role key (bypasses RLS,
-- acting as "admin" tier); RLS blocks the anon key and any direct client access.
-- The edge layer also sets request.app_user_id per request when using a
-- non-service connection, which these policies honor.

create or replace function app_current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.app_user_id', true), '')::uuid
$$;

alter table users enable row level security;
alter table drivers enable row level security;
alter table driver_locations enable row level security;
alter table vehicles enable row level security;
alter table bookings enable row level security;
alter table booking_events enable row level security;
alter table payments enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;
alter table driver_documents enable row level security;

-- users: a user sees/updates only their own row
create policy users_self_select on users for select using (id = app_current_user_id());
create policy users_self_update on users for update using (id = app_current_user_id());

-- drivers: driver sees/updates own row; anyone authenticated may read verified drivers (for browsing)
create policy drivers_self_all on drivers for all using (user_id = app_current_user_id());
create policy drivers_public_read on drivers for select using (is_verified = true);

-- driver_locations: driver manages own location; verified+available drivers readable
create policy driver_locations_self on driver_locations for all
  using (driver_id in (select id from drivers where user_id = app_current_user_id()));
create policy driver_locations_read on driver_locations for select
  using (driver_id in (select id from drivers where is_verified = true and is_available = true));

-- vehicles: customer only sees own vehicles
create policy vehicles_owner on vehicles for all using (customer_id = app_current_user_id());

-- bookings: visible to booking customer or assigned driver
create policy bookings_customer on bookings for all using (customer_id = app_current_user_id());
create policy bookings_driver on bookings for select
  using (driver_id in (select id from drivers where user_id = app_current_user_id()));
create policy bookings_driver_update on bookings for update
  using (driver_id in (select id from drivers where user_id = app_current_user_id()));

-- booking_events: readable by parties to the booking
create policy booking_events_parties on booking_events for select
  using (booking_id in (
    select b.id from bookings b
    left join drivers d on d.id = b.driver_id
    where b.customer_id = app_current_user_id() or d.user_id = app_current_user_id()
  ));

-- payments: parties to the booking
create policy payments_parties on payments for select
  using (booking_id in (
    select b.id from bookings b
    left join drivers d on d.id = b.driver_id
    where b.customer_id = app_current_user_id() or d.user_id = app_current_user_id()
  ));

-- reviews: customer manages own reviews; driver reviews publicly readable
create policy reviews_customer on reviews for all using (customer_id = app_current_user_id());
create policy reviews_public_read on reviews for select using (true);

-- notifications: own only
create policy notifications_own on notifications for select using (user_id = app_current_user_id());

-- driver_documents: driver's own only
create policy driver_documents_own on driver_documents for all
  using (driver_id in (select id from drivers where user_id = app_current_user_id()));
