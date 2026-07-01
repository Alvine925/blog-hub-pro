create table if not exists collections (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  description text,
  schema jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists collection_entries (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid not null references collections(id) on delete cascade,
  data jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists collection_entries_collection_id_idx on collection_entries(collection_id);
create index if not exists collection_entries_status_idx on collection_entries(status);
