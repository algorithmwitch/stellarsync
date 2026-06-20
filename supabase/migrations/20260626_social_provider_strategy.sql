-- Social provider strategy fields.
-- Default is native; aggregator profile keys are written by service-role Edge Functions only.

alter table public.social_accounts
  add column if not exists social_provider_strategy text not null default 'native',
  add column if not exists aggregator_provider text not null default 'none',
  add column if not exists aggregator_profile_key text;

alter table public.scheduled_social_posts
  add column if not exists social_provider_strategy text not null default 'native',
  add column if not exists aggregator_provider text not null default 'none';

alter table public.social_accounts
  drop constraint if exists social_accounts_provider_strategy_check,
  add constraint social_accounts_provider_strategy_check
    check (social_provider_strategy in ('native', 'aggregator')),
  drop constraint if exists social_accounts_aggregator_provider_check,
  add constraint social_accounts_aggregator_provider_check
    check (aggregator_provider in ('none', 'ayrshare', 'buffer'));

alter table public.scheduled_social_posts
  drop constraint if exists scheduled_social_posts_provider_strategy_check,
  add constraint scheduled_social_posts_provider_strategy_check
    check (social_provider_strategy in ('native', 'aggregator')),
  drop constraint if exists scheduled_social_posts_aggregator_provider_check,
  add constraint scheduled_social_posts_aggregator_provider_check
    check (aggregator_provider in ('none', 'ayrshare', 'buffer'));

create index if not exists social_accounts_provider_strategy_idx
  on public.social_accounts(workspace_id, social_provider_strategy, aggregator_provider);
