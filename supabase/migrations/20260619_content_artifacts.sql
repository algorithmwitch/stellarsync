-- StellarSync content artifacts for Supabase-native workspaces.
-- Notes, inspo, AI drafts, and artifact flow links.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  note_id text not null,
  title text,
  body text,
  summary text,
  source_type text,
  source_url text,
  campaign_id text,
  campaign_name text,
  pillar text,
  linked_post_id text,
  linked_ai_draft_id text,
  flow_state text not null default 'active',
  converted_post_id text,
  source_note_id text,
  source_inspo_id text,
  source_ai_draft_id text,
  source_import_job_id text,
  created_from_flow text,
  moved_to_post_at timestamptz,
  archived_at timestamptz,
  status text,
  suggested_platform text,
  suggested_pillar text,
  bullets text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, note_id)
);

create table if not exists public.inspo (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inspo_id text not null,
  title text,
  summary text,
  body text,
  source_url text,
  source_type text,
  source_label text,
  source_title text,
  campaign_id text,
  campaign_name text,
  pillar text,
  linked_post_id text,
  linked_ai_draft_id text,
  flow_state text not null default 'active',
  converted_post_id text,
  source_note_id text,
  source_inspo_id text,
  source_ai_draft_id text,
  source_import_job_id text,
  created_from_flow text,
  moved_to_post_at timestamptz,
  archived_at timestamptz,
  status text,
  suggested_platform text,
  suggested_pillar text,
  pages text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, inspo_id)
);

create table if not exists public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ai_draft_id text not null,
  title text,
  draft_text text,
  generated_output text,
  source_type text,
  source_id text,
  prompt text,
  generation_mode text,
  draft_status text not null default 'needs_review',
  campaign_id text,
  campaign_name text,
  pillar text,
  platform_targets text[] not null default '{}',
  media_ids text[] not null default '{}',
  created_post_id text,
  parent_artifact_id text,
  root_artifact_id text,
  derived_from_ids text,
  target_platforms text,
  target_campaign_id text,
  target_date text,
  review_notes text,
  alignment_score numeric default 0,
  brand_framework_version text,
  idea_prompt text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, ai_draft_id)
);

create table if not exists public.artifact_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_type text not null,
  from_id text not null,
  to_type text not null,
  to_id text not null,
  relationship_type text not null default 'derived',
  created_at timestamptz not null default now()
);

-- Indexes

create index if not exists notes_workspace_updated_idx
  on public.notes(workspace_id, updated_at desc);

create index if not exists notes_flow_state_idx
  on public.notes(workspace_id, flow_state);

create index if not exists inspo_workspace_updated_idx
  on public.inspo(workspace_id, updated_at desc);

create index if not exists inspo_flow_state_idx
  on public.inspo(workspace_id, flow_state);

create index if not exists ai_drafts_workspace_updated_idx
  on public.ai_drafts(workspace_id, updated_at desc);

create index if not exists ai_drafts_status_idx
  on public.ai_drafts(workspace_id, draft_status);

create index if not exists artifact_links_workspace_idx
  on public.artifact_links(workspace_id);

create index if not exists artifact_links_from_idx
  on public.artifact_links(workspace_id, from_type, from_id);

create index if not exists artifact_links_to_idx
  on public.artifact_links(workspace_id, to_type, to_id);

-- RLS

alter table public.notes enable row level security;
alter table public.inspo enable row level security;
alter table public.ai_drafts enable row level security;
alter table public.artifact_links enable row level security;

drop policy if exists "workspace members can read notes" on public.notes;
create policy "workspace members can read notes"
on public.notes for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = notes.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace members can manage notes" on public.notes;
create policy "workspace members can manage notes"
on public.notes for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = notes.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = notes.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace members can read inspo" on public.inspo;
create policy "workspace members can read inspo"
on public.inspo for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = inspo.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace members can manage inspo" on public.inspo;
create policy "workspace members can manage inspo"
on public.inspo for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = inspo.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = inspo.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace members can read ai drafts" on public.ai_drafts;
create policy "workspace members can read ai drafts"
on public.ai_drafts for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ai_drafts.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace members can manage ai drafts" on public.ai_drafts;
create policy "workspace members can manage ai drafts"
on public.ai_drafts for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ai_drafts.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ai_drafts.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace members can read artifact links" on public.artifact_links;
create policy "workspace members can read artifact links"
on public.artifact_links for select
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = artifact_links.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "workspace members can manage artifact links" on public.artifact_links;
create policy "workspace members can manage artifact links"
on public.artifact_links for all
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = artifact_links.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = artifact_links.workspace_id
      and wm.user_id = auth.uid()
  )
);

-- Updated_at triggers

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists inspo_set_updated_at on public.inspo;
create trigger inspo_set_updated_at
before update on public.inspo
for each row execute function public.set_updated_at();

drop trigger if exists ai_drafts_set_updated_at on public.ai_drafts;
create trigger ai_drafts_set_updated_at
before update on public.ai_drafts
for each row execute function public.set_updated_at();
