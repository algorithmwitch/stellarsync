-- StellarSync launch core tables.
-- Supabase is the primary backend for normal workspaces; Apps Script is only for legacy hybrid workspaces.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workspace_slug text,
  post_id text not null,
  title text,
  description text,
  status text not null default 'draft',
  publish_status text not null default 'draft',
  publish_date text,
  publish_time text,
  scheduled_at timestamptz,
  platform text,
  platform_targets text[] not null default '{}',
  campaign_id text,
  campaign_name text,
  pillar text,
  format text,
  post_type text,
  media_id text,
  media_url text,
  media_type text,
  media_filename text,
  media_alt_text text,
  storage_path text,
  monday_item_id text,
  monday_synced_at timestamptz,
  monday_sync_status text,
  published_url text,
  published_at timestamptz,
  source_url text,
  source_platform text,
  created_by uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, post_id)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id text not null,
  title text,
  media_title text,
  asset_name text,
  media_url text,
  thumbnail_url text,
  storage_path text,
  bucket text,
  media_type text,
  mime_type text,
  source text not null default 'supabase',
  metadata jsonb not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, asset_id)
);

create index if not exists posts_workspace_updated_idx
  on public.posts(workspace_id, updated_at desc);

create index if not exists posts_workspace_schedule_idx
  on public.posts(workspace_id, scheduled_at);

create index if not exists media_assets_workspace_updated_idx
  on public.media_assets(workspace_id, updated_at desc);

alter table public.posts enable row level security;
alter table public.media_assets enable row level security;

drop policy if exists "workspace members can read posts" on public.posts;
create policy "workspace members can read posts"
on public.posts for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = posts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
);

drop policy if exists "workspace members can manage posts" on public.posts;
create policy "workspace members can manage posts"
on public.posts for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = posts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = posts.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
);

drop policy if exists "workspace members can read media assets" on public.media_assets;
create policy "workspace members can read media assets"
on public.media_assets for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = media_assets.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
);

drop policy if exists "workspace members can manage media assets" on public.media_assets;
create policy "workspace members can manage media assets"
on public.media_assets for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = media_assets.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = media_assets.workspace_id
      and (wm.user_id = auth.uid() or wm.user_id = auth.uid())
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at
before update on public.media_assets
for each row execute function public.set_updated_at();

create or replace view public.scheduled_posts as
select *
from public.scheduled_social_posts;
