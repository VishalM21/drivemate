create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text,
  body text,
  data jsonb,
  status text default 'sent',
  created_at timestamptz default now()
);

create index if not exists idx_notifications_user on notifications(user_id, created_at desc);
