alter table public.workspace_members
add column if not exists created_at timestamptz not null default now();

alter table public.workspace_members
add column if not exists updated_at timestamptz not null default now();

alter table public.workspace_invites
add column if not exists updated_at timestamptz not null default now();

update public.workspace_members
set created_at = now()
where created_at is null;

update public.workspace_members
set updated_at = now()
where updated_at is null;

update public.workspace_invites
set updated_at = now()
where updated_at is null;

alter table public.workspace_members
alter column created_at set default now(),
alter column created_at set not null,
alter column updated_at set default now(),
alter column updated_at set not null;

alter table public.workspace_invites
alter column updated_at set default now(),
alter column updated_at set not null;

do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    if not exists (
      select 1 from pg_trigger
      where tgname = 'workspace_members_set_updated_at'
        and tgrelid = 'public.workspace_members'::regclass
    ) then
      create trigger workspace_members_set_updated_at
      before update on public.workspace_members
      for each row execute function public.set_updated_at();
    end if;

    if not exists (
      select 1 from pg_trigger
      where tgname = 'workspace_invites_set_updated_at'
        and tgrelid = 'public.workspace_invites'::regclass
    ) then
      create trigger workspace_invites_set_updated_at
      before update on public.workspace_invites
      for each row execute function public.set_updated_at();
    end if;
  end if;
end $$;
