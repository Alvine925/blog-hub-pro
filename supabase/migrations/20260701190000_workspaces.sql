create table if not exists workspaces (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into workspaces (name, slug, description)
values ('Default', 'default', 'Default workspace')
on conflict (slug) do nothing;
