-- ─────────────────────────────────────────────────────────────────────────────
-- Workspace-level RBAC + platform roles
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend cms_users with platform-level role and password-change flag
alter table cms_users
  add column if not exists platform_role text
    default 'member'
    check (platform_role in ('superadmin', 'co_admin', 'member')),
  add column if not exists password_change_required boolean
    default false;

-- 2. Workspace members table
create table if not exists workspace_members (
  id                    uuid        primary key default gen_random_uuid(),
  workspace_id          uuid        not null references workspaces(id) on delete cascade,
  email                 text        not null,
  name                  text,
  user_id               uuid        references auth.users(id) on delete set null,
  workspace_role        text        not null default 'viewer'
                          check (workspace_role in ('workspace_admin', 'editor', 'viewer')),
  content_permissions   text[]      not null default array['all'],
  status                text        not null default 'pending'
                          check (status in ('pending', 'active', 'suspended')),
  invited_by            uuid,
  invited_at            timestamptz default now(),
  accepted_at           timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  constraint unique_workspace_member_email unique (workspace_id, email)
);

-- Indexes
create index if not exists idx_wm_user_id      on workspace_members (user_id);
create index if not exists idx_wm_workspace_id on workspace_members (workspace_id);
create index if not exists idx_wm_email        on workspace_members (email);

-- RLS
alter table workspace_members enable row level security;

drop policy if exists "service_role_all_workspace_members" on workspace_members;
create policy "service_role_all_workspace_members" on workspace_members
  for all using (true);

-- Grants
grant all on workspace_members to service_role;
grant select, insert, update, delete on workspace_members to authenticated;
