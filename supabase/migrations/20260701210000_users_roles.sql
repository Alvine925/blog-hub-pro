create table if not exists cms_users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  name text,
  role text not null default 'editor' check (role in ('admin','editor','viewer')),
  avatar_url text,
  created_at timestamptz default now(),
  last_login_at timestamptz
);

create table if not exists cms_user_invites (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  role text not null default 'editor',
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days'),
  accepted_at timestamptz
);
