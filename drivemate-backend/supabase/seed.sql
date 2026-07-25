-- Local development seed data (supabase db reset applies this automatically)
insert into users (id, firebase_uid, phone, role, full_name, ride_otp) values
  ('00000000-0000-0000-0000-000000000001','seed-admin','9000000001','admin','Seed Admin', null),
  ('00000000-0000-0000-0000-000000000002','seed-customer','9999999999','customer','Seed Customer', '1234'),
  ('00000000-0000-0000-0000-000000000003','seed-driver','9999999997','driver','Seed Driver 1', null),
  ('00000000-0000-0000-0000-000000000004','seed-driver-2','9999999998','driver','Seed Driver 2', null)
on conflict do nothing;

insert into drivers (id, user_id, price_per_trip, is_verified, is_available, license_number, experience_years, languages, service_local, service_airport, service_outstation, service_night)
values 
  ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-000000000003', 400, true, true, 'UP78-DL-2020-0001', 3, '{Hindi,English}', true, true, true, true),
  ('00000000-0000-0000-0000-00000000d002','00000000-0000-0000-0000-000000000004', 500, true, true, 'UP78-DL-2020-0002', 3, '{Hindi,English}', true, false, true, true)
on conflict do nothing;

insert into driver_locations (driver_id, latitude, longitude, is_online)
values 
  ('00000000-0000-0000-0000-00000000d001', 26.4499, 80.3319, true),
  ('00000000-0000-0000-0000-00000000d002', 26.4600, 80.3400, true)
on conflict (driver_id) do update set latitude = excluded.latitude, longitude = excluded.longitude, is_online = true;
