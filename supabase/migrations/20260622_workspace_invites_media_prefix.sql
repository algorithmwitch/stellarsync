-- PART 1: Add media_prefix column to workspace_settings
alter table public.workspace_settings
add column if not exists media_prefix text;

-- PART 2: Create workspace_invites table
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  status text not null default 'pending',
  invited_by uuid references auth.users(id),
  accepted_by uuid references auth.users(id),
  token text unique,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists workspace_invites_pending_unique
  on public.workspace_invites (workspace_id, lower(email))
  where status = 'pending';

-- RLS: workspace_invites
alter table public.workspace_invites enable row level security;

-- Workspace admins/owners/content_leads can view invites
create policy workspace_invites_select_workspace_admin
  on public.workspace_invites
  for select
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspace_invites.workspace_id
        and workspace_members.user_id = auth.uid()
        and workspace_members.role in ('owner', 'admin', 'content_lead')
    )
  );

-- Only owner/admin can create invites
create policy workspace_invites_insert_workspace_admin
  on public.workspace_invites
  for insert
  with check (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspace_invites.workspace_id
        and workspace_members.user_id = auth.uid()
        and workspace_members.role in ('owner', 'admin')
    )
  );

-- Only owner/admin can update invites
create policy workspace_invites_update_workspace_admin
  on public.workspace_invites
  for update
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspace_invites.workspace_id
        and workspace_members.user_id = auth.uid()
        and workspace_members.role in ('owner', 'admin')
    )
  );

-- Only owner/admin can delete invites
create policy workspace_invites_delete_workspace_admin
  on public.workspace_invites
  for delete
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspace_invites.workspace_id
        and workspace_members.user_id = auth.uid()
        and workspace_members.role in ('owner', 'admin')
    )
  );

-- Invited user can view their own invite if authenticated (matched by email)
create policy workspace_invites_select_self
  on public.workspace_invites
  for select
  using (
    status = 'pending'
    and lower(email) = lower((select email from auth.users where id = auth.uid()))
  );
