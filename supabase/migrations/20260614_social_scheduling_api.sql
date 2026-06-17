-- StellarSync social scheduling API scaffold.
-- Apply this migration in Supabase before deploying the social Edge Functions.

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  provider_username text,
  display_name text,
  avatar_url text,
  access_status text not null default 'not_connected',
  token_status text not null default 'missing',
  scopes text[] not null default '{}',
  expires_at timestamptz,
  last_connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, provider, provider_user_id)
);

create table if not exists public.scheduled_social_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_type text not null default 'stellar_post',
  source_id text,
  provider text not null,
  social_account_id uuid references public.social_accounts(id) on delete set null,
  post_payload jsonb not null default '{}',
  media_payload jsonb not null default '{}',
  scheduled_for timestamptz,
  status text not null default 'draft',
  publish_result jsonb not null default '{}',
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  provider text not null,
  state text not null unique,
  redirect_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz
);

create index if not exists social_accounts_workspace_provider_idx
  on public.social_accounts(workspace_id, provider);

create index if not exists scheduled_social_posts_workspace_status_idx
  on public.scheduled_social_posts(workspace_id, status);

create index if not exists scheduled_social_posts_due_idx
  on public.scheduled_social_posts(status, scheduled_for);

create index if not exists social_oauth_states_state_idx
  on public.social_oauth_states(state);

alter table public.social_accounts enable row level security;
alter table public.scheduled_social_posts enable row level security;
alter table public.social_oauth_states enable row level security;

drop policy if exists "workspace members can read social accounts" on public.social_accounts;
create policy "workspace members can read social accounts"
on public.social_accounts for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = social_accounts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
);

drop policy if exists "workspace admins can manage social accounts" on public.social_accounts;
create policy "workspace admins can manage social accounts"
on public.social_accounts for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = social_accounts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
      and lower(coalesce(wm.role, '')) in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = social_accounts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
      and lower(coalesce(wm.role, '')) in ('owner', 'admin')
  )
);

drop policy if exists "workspace members can read scheduled social posts" on public.scheduled_social_posts;
create policy "workspace members can read scheduled social posts"
on public.scheduled_social_posts for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = scheduled_social_posts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
);

drop policy if exists "workspace admins can manage scheduled social posts" on public.scheduled_social_posts;
create policy "workspace admins can manage scheduled social posts"
on public.scheduled_social_posts for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = scheduled_social_posts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
      and lower(coalesce(wm.role, '')) in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = scheduled_social_posts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
      and lower(coalesce(wm.role, '')) in ('owner', 'admin')
  )
);

drop policy if exists "users can read own oauth states" on public.social_oauth_states;
create policy "users can read own oauth states"
on public.social_oauth_states for select
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = social_oauth_states.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
);

drop policy if exists "users can insert own oauth states" on public.social_oauth_states;
create policy "users can insert own oauth states"
on public.social_oauth_states for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = social_oauth_states.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
);

drop policy if exists "users can update own oauth states" on public.social_oauth_states;
create policy "users can update own oauth states"
on public.social_oauth_states for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists social_accounts_set_updated_at on public.social_accounts;
create trigger social_accounts_set_updated_at
before update on public.social_accounts
for each row execute function public.set_updated_at();

drop trigger if exists scheduled_social_posts_set_updated_at on public.scheduled_social_posts;
create trigger scheduled_social_posts_set_updated_at
before update on public.scheduled_social_posts
for each row execute function public.set_updated_at();

-- Token storage note:
-- Phase 1 stores OAuth token data in social_accounts.metadata.token_data via service-role Edge Functions only.
-- RLS/client responses must never expose metadata.token_data. For production hardening, move token_data
-- into a separate non-exposed vault table or Supabase Vault once enabled for the project.
