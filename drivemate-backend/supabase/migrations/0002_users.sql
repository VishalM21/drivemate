create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique not null,
  phone text unique not null,
  role text not null check (role in ('customer','driver','admin')),
  full_name text,
  email text,
  avatar_url text,
  fcm_token text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_users_phone on users(phone);
create index if not exists idx_users_role on users(role);

-- generic updated_at trigger reused by all tables
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at before update on users
for each row execute function set_updated_at();
