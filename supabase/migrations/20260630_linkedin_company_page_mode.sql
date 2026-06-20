-- LinkedIn company/page publishing support fields.
-- Existing member rows remain valid; organization/page data is optional and Managed-only in the UI.

alter table public.social_accounts
  add column if not exists account_type text not null default 'member',
  add column if not exists member_urn text,
  add column if not exists organization_urn text,
  add column if not exists organization_name text,
  add column if not exists scopes_granted text[] not null default '{}',
  add column if not exists app_source text not null default 'stellar_hosted';

alter table public.social_accounts
  drop constraint if exists social_accounts_account_type_check,
  add constraint social_accounts_account_type_check
    check (account_type in ('member', 'organization')),
  drop constraint if exists social_accounts_app_source_check,
  add constraint social_accounts_app_source_check
    check (app_source in ('stellar_hosted', 'client_owned', 'managed_setup'));

create index if not exists social_accounts_workspace_provider_type_idx
  on public.social_accounts(workspace_id, provider, account_type);

alter table public.workspace_settings
  add column if not exists linkedin_company_publishing_status text not null default 'unavailable',
  add column if not exists linkedin_app_source text not null default 'stellar_hosted';

alter table public.workspace_settings
  drop constraint if exists workspace_settings_linkedin_company_publishing_status_check,
  add constraint workspace_settings_linkedin_company_publishing_status_check
    check (linkedin_company_publishing_status in ('unavailable', 'pending_approval', 'approved', 'connected')),
  drop constraint if exists workspace_settings_linkedin_app_source_check,
  add constraint workspace_settings_linkedin_app_source_check
    check (linkedin_app_source in ('stellar_hosted', 'client_owned', 'managed_setup'));
