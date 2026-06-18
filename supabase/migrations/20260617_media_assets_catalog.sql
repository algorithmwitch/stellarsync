-- Harden Supabase media catalog for first-class, unlinked media assets.

alter table public.media_assets
  alter column asset_id drop not null;

alter table public.media_assets
  add column if not exists filename text,
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists duration_seconds numeric,
  add column if not exists alt_text text,
  add column if not exists linked_post_id text,
  add column if not exists linked_note_id text,
  add column if not exists linked_inspo_id text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists size_bytes bigint;

update public.media_assets
set storage_path = coalesce(nullif(storage_path, ''), nullif(asset_id, ''), id::text)
where storage_path is null or storage_path = '';

alter table public.media_assets
  alter column storage_path set not null,
  alter column bucket set default 'media',
  alter column source set default 'supabase_storage',
  alter column metadata set default '{}',
  alter column tags set default '{}',
  alter column created_at set default now(),
  alter column updated_at set default now();

update public.media_assets
set
  bucket = coalesce(nullif(bucket, ''), 'media'),
  filename = coalesce(filename, asset_name, media_title, title),
  source = coalesce(nullif(source, ''), 'supabase_storage'),
  tags = coalesce(tags, '{}'),
  metadata = coalesce(metadata, '{}')
where true;

alter table public.media_assets
  alter column metadata set not null,
  alter column tags set not null;

create unique index if not exists media_assets_workspace_bucket_storage_path_uidx
  on public.media_assets(workspace_id, bucket, storage_path);

create index if not exists media_assets_workspace_linked_post_idx
  on public.media_assets(workspace_id, linked_post_id);

alter table public.media_assets enable row level security;

drop policy if exists "workspace members can read media assets" on public.media_assets;
create policy "workspace members can read media assets"
on public.media_assets for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = media_assets.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace members can manage media assets" on public.media_assets;
create policy "workspace members can manage media assets"
on public.media_assets for all
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = media_assets.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = media_assets.workspace_id
      and wm.user_id = auth.uid()
  )
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id text not null,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, post_id, media_asset_id)
);

alter table public.posts
  add column if not exists media_ids text[] not null default '{}';

alter table public.post_media enable row level security;

drop policy if exists "workspace members can manage post media" on public.post_media;
create policy "workspace members can manage post media"
on public.post_media for all
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = post_media.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = post_media.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop trigger if exists post_media_set_updated_at on public.post_media;
create trigger post_media_set_updated_at
before update on public.post_media
for each row execute function public.set_updated_at();
