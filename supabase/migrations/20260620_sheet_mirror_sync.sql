-- StellarSync managed Google Sheets mirror sync.
-- Config tracking + sync metadata for managed mirror workspaces.
-- Supabase remains canonical; Sheets are optional editable mirrors.

alter table public.workspace_settings
  add column if not exists backend_type text not null default 'supabase_native',
  add column if not exists google_sheet_id text,
  add column if not exists apps_script_url text,
  add column if not exists sheet_sync_enabled boolean not null default false,
  add column if not exists sheet_sync_direction text not null default 'bidirectional',
  add column if not exists sheet_last_pulled_at timestamptz,
  add column if not exists sheet_last_pushed_at timestamptz;

comment on column public.workspace_settings.backend_type is 'supabase_native | google_sheets_hybrid | managed_mirror';
comment on column public.workspace_settings.sheet_sync_direction is 'supabase_to_sheet | sheet_to_supabase | bidirectional';

create table if not exists public.sheet_mirror_status (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  artifact_type text not null,
  sheet_tab text not null,
  last_pushed_at timestamptz,
  last_pulled_at timestamptz,
  last_pushed_count int not null default 0,
  last_pulled_count int not null default 0,
  last_push_error text,
  last_pull_error text,
  conflict_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, artifact_type)
);

alter table public.sheet_mirror_status enable row level security;

create policy "workspace_members_can_read_mirror_status"
  on public.sheet_mirror_status for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

create policy "workspace_members_can_insert_mirror_status"
  on public.sheet_mirror_status for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

create policy "workspace_members_can_update_mirror_status"
  on public.sheet_mirror_status for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

-- Ensure workspace_settings has RLS
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'workspace_settings' and policyname = 'workspace_members_can_read_workspace_settings'
  ) then
    create policy "workspace_members_can_read_workspace_settings"
      on public.workspace_settings for select
      using (
        workspace_id in (
          select workspace_id from public.workspace_members where user_id = auth.uid()
        )
      );
  end if;
end
$$;

-- Trigger for updated_at
create or replace function public.update_sheet_mirror_status_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sheet_mirror_status_updated_at on public.sheet_mirror_status;
create trigger trg_sheet_mirror_status_updated_at
  before update on public.sheet_mirror_status
  for each row execute function public.update_sheet_mirror_status_updated_at();
