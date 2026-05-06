create table sessions (
  id            text primary key,
  name          text not null,
  mode          text not null check (mode in ('owner', 'mixed', 'open')),
  edit_key_hash text not null,
  created_at    timestamptz default now()
);

create table pins (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null references sessions(id) on delete cascade,
  lat         float8 not null,
  lng         float8 not null,
  type        text not null check (type in ('trip', 'home')),
  message     text not null default '',
  date        date,
  created_at  timestamptz default now()
);

-- Enable Row Level Security
alter table sessions enable row level security;
alter table pins enable row level security;

-- Public read access (anon key can SELECT)
create policy "sessions: public read"
  on sessions for select using (true);

create policy "pins: public read"
  on pins for select using (true);
