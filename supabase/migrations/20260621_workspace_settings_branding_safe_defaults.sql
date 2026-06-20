alter table public.workspace_settings
add column if not exists constellation_shape text default 'star';

alter table public.workspace_settings
add column if not exists avatar_mode text default 'initials';

alter table public.workspace_settings
add column if not exists icon text;

alter table public.workspace_settings
add column if not exists avatar_initials text;

alter table public.workspace_settings
add column if not exists short_name text;

alter table public.workspace_settings
add column if not exists media_bucket text default 'media';
