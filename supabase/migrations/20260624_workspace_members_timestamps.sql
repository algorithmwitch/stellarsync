-- Add created_at and updated_at to workspace_members
alter table public.workspace_members
add column if not exists created_at timestamptz default now();

alter table public.workspace_members
add column if not exists updated_at timestamptz default now();

-- Backfill existing rows
update public.workspace_members
set created_at = now()
where created_at is null;

update public.workspace_members
set updated_at = now()
where updated_at is null;

-- Add updated_at triggers only when the shared trigger function exists.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
    create trigger workspace_members_set_updated_at
    before update on public.workspace_members
    for each row execute function public.set_updated_at();

    drop trigger if exists workspace_invites_set_updated_at on public.workspace_invites;
    create trigger workspace_invites_set_updated_at
    before update on public.workspace_invites
    for each row execute function public.set_updated_at();
  end if;
end $$;

