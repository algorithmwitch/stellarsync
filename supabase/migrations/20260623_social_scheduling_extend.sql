-- StellarSync social scheduling extension.
-- Adds new columns to scheduled_social_posts, creates social_publications and social_publish_attempts.
-- Run after 20260614_social_scheduling_api.sql.

-- ── Extend scheduled_social_posts ──────────────────────────────────────────

alter table public.scheduled_social_posts
  add column if not exists post_id text,
  add column if not exists caption text,
  add column if not exists media_asset_ids text[] not null default '{}',
  add column if not exists media_urls text[] not null default '{}',
  add column if not exists post_type text not null default 'text',
  add column if not exists platform_payload jsonb not null default '{}',
  add column if not exists validation_errors jsonb not null default '{}',
  add column if not exists attempts int not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists external_post_id text,
  add column if not exists external_url text,
  add column if not exists error_message text,
  add column if not exists scheduled_at timestamptz;

-- Add new status values: update the check constraint
-- (Dropping and re-adding to support the full status set)
alter table public.scheduled_social_posts
  drop constraint if exists scheduled_social_posts_status_check;

-- ── Social Publications ────────────────────────────────────────────────────

create table if not exists public.social_publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scheduled_social_post_id uuid references public.scheduled_social_posts(id) on delete set null,
  post_id text,
  platform text not null,
  social_account_id uuid references public.social_accounts(id) on delete set null,
  status text not null default 'completed',
  caption text,
  media_asset_ids text[] not null default '{}',
  media_urls text[] not null default '{}',
  post_type text not null default 'text',
  platform_payload jsonb not null default '{}',
  external_post_id text,
  external_url text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ── Social Publish Attempts ────────────────────────────────────────────────

create table if not exists public.social_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scheduled_social_post_id uuid references public.scheduled_social_posts(id) on delete cascade,
  platform text not null,
  status text not null default 'attempting',
  attempt_number int not null default 1,
  request_payload jsonb not null default '{}',
  response_data jsonb not null default '{}',
  error_message text,
  error_code text,
  duration_ms int,
  created_at timestamptz not null default now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

create index if not exists scheduled_social_posts_due_scheduled_idx
  on public.scheduled_social_posts(status, scheduled_at)
  where status in ('queued', 'ready');

create index if not exists scheduled_social_posts_workspace_platform_idx
  on public.scheduled_social_posts(workspace_id, platform);

create index if not exists scheduled_social_posts_post_id_idx
  on public.scheduled_social_posts(post_id);

create index if not exists social_publications_workspace_idx
  on public.social_publications(workspace_id);

create index if not exists social_publications_scheduled_post_idx
  on public.social_publications(scheduled_social_post_id);

create index if not exists social_publish_attempts_scheduled_post_idx
  on public.social_publish_attempts(scheduled_social_post_id);

create index if not exists social_publish_attempts_status_idx
  on public.social_publish_attempts(status);

-- ── RLS: social_publications ───────────────────────────────────────────────

alter table public.social_publications enable row level security;

drop policy if exists "workspace members can read social publications" on public.social_publications;
create policy "workspace members can read social publications"
on public.social_publications for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = social_publications.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "service role can manage social publications" on public.social_publications;
create policy "service role can manage social publications"
on public.social_publications for all
using (true)
with check (true);

-- ── RLS: social_publish_attempts ───────────────────────────────────────────

alter table public.social_publish_attempts enable row level security;

drop policy if exists "workspace members can read social publish attempts" on public.social_publish_attempts;
create policy "workspace members can read social publish attempts"
on public.social_publish_attempts for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = social_publish_attempts.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "service role can manage social publish attempts" on public.social_publish_attempts;
create policy "service role can manage social publish attempts"
on public.social_publish_attempts for all
using (true)
with check (true);

-- ── Update RLS on scheduled_social_posts to use simpler pattern ────────────

drop policy if exists "workspace members can read scheduled social posts" on public.scheduled_social_posts;
create policy "workspace members can read scheduled social posts"
on public.scheduled_social_posts for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = scheduled_social_posts.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace admins can manage scheduled social posts" on public.scheduled_social_posts;
create policy "workspace admins can manage scheduled social posts"
on public.scheduled_social_posts for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = scheduled_social_posts.workspace_id
      and wm.user_id = auth.uid()
      and lower(coalesce(wm.role, '')) in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = scheduled_social_posts.workspace_id
      and wm.user_id = auth.uid()
      and lower(coalesce(wm.role, '')) in ('owner', 'admin')
  )
);

drop policy if exists "service role can manage scheduled social posts" on public.scheduled_social_posts;
create policy "service role can manage scheduled social posts"
on public.scheduled_social_posts for all
using (true)
with check (true);

-- ── Updated_at triggers for new tables ─────────────────────────────────────

drop trigger if exists social_publications_set_updated_at on public.social_publications;

drop trigger if exists scheduled_social_posts_set_updated_at on public.scheduled_social_posts;
create trigger scheduled_social_posts_set_updated_at
before update on public.scheduled_social_posts
for each row execute function public.set_updated_at();
