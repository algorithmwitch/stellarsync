alter table public.workspaces
  add column if not exists plan_slug text default 'starter',
  add column if not exists subscription_tier text default 'starter',
  add column if not exists managed_account boolean default false,
  add column if not exists is_admin_workspace boolean default false,
  add column if not exists feature_flags jsonb default '{}'::jsonb;

alter table public.workspace_settings
  add column if not exists plan_slug text default 'starter',
  add column if not exists subscription_tier text default 'starter',
  add column if not exists managed_account boolean default false,
  add column if not exists is_admin_workspace boolean default false,
  add column if not exists feature_flags jsonb default '{}'::jsonb;

update public.workspaces
set
  plan_slug = coalesce(nullif(plan_slug, ''), nullif(plan, ''), 'starter'),
  subscription_tier = coalesce(nullif(subscription_tier, ''), nullif(plan, ''), 'starter'),
  feature_flags = coalesce(feature_flags, '{}'::jsonb)
where plan_slug is null
   or plan_slug = ''
   or subscription_tier is null
   or subscription_tier = ''
   or feature_flags is null;

update public.workspace_settings
set
  plan_slug = coalesce(nullif(plan_slug, ''), 'starter'),
  subscription_tier = coalesce(nullif(subscription_tier, ''), nullif(plan_slug, ''), 'starter'),
  feature_flags = coalesce(feature_flags, '{}'::jsonb)
where plan_slug is null
   or plan_slug = ''
   or subscription_tier is null
   or subscription_tier = ''
   or feature_flags is null;
