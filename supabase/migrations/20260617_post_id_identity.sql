-- Make post_id the canonical cross-system identity for posts.
alter table public.posts
add column if not exists post_id text;

update public.posts
set post_id = 'post_' || id::text
where nullif(trim(coalesce(post_id, '')), '') is null;

alter table public.posts
  alter column post_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.posts'::regclass
      and conname = 'posts_workspace_id_post_id_key'
  ) then
    alter table public.posts
      add constraint posts_workspace_id_post_id_key unique (workspace_id, post_id);
  end if;
end $$;

create or replace function public.ensure_post_id()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.post_id is not null and trim(old.post_id) <> '' then
    new.post_id = old.post_id;
    return new;
  end if;

  if nullif(trim(coalesce(new.post_id, '')), '') is null then
    new.post_id = 'post_' || gen_random_uuid()::text;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_ensure_post_id on public.posts;
create trigger posts_ensure_post_id
before insert or update on public.posts
for each row execute function public.ensure_post_id();

create index if not exists scheduled_social_posts_workspace_source_idx
  on public.scheduled_social_posts(workspace_id, source_id);
