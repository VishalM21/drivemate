alter table users
add column if not exists aadhar_number text,
add column if not exists rc_number text,
add column if not exists car_number text,
add column if not exists dl_number text;
