# StellarSync React Migration Architecture

## Legacy frontend inventory

- Primary app shell: `app/index.html`
- Boot sequence:
  - restores local/session cache and shell layout
  - restores Supabase auth session
  - resolves active workspace from runtime config, URL, and `STELLARSYNC_ACTIVE_WORKSPACE`
  - renders calendar first, then runs `queueBootLazyHydration()`
- Connected Accounts:
  - hydrated through `apiGetConnectedAccountsStatus()` in `app/index.html`
  - source of truth is `social-connection-status`
  - callback success is inferred from query params such as `social_success` and `connected`
- Legacy storage keys:
  - `STELLARSYNC_ACTIVE_WORKSPACE`
  - `APP_CONFIG.STORAGE_KEY`
  - workspace-scoped profile caches from `getWorkspaceProfileCacheKey()`

## OAuth/backend lifecycle discovered

- OAuth start: `supabase/functions/social-auth-start/index.ts`
- OAuth callback: `supabase/functions/social-auth-callback/index.ts`
- Status query: `supabase/functions/social-connection-status/index.ts`
- Shared helpers: `supabase/functions/_shared/social.ts`

## Current schema discovered

- Canonical persisted account table: `public.social_accounts`
- Auxiliary workspace metadata table: `public.workspace_connections`
- OAuth state table: `public.social_oauth_states`
- Workspace identity table: `public.workspace_members`
- Workspace settings table: `public.workspace_settings`

## Current LinkedIn mismatch

- Callback persists LinkedIn rows into `social_accounts` with `account_type = 'member'`
- Status collapses records by provider and labels LinkedIn generically
- OAuth state does not persist `account_type`
- Callback redirect uses `connected=<provider>` / `social_success=<provider>` rather than an explicit finalized status signal
- Token data is stored in `social_accounts.metadata.token_data`, which must remain server-only

## Migration strategy

- Keep legacy app at `/app/legacy/`
- Build React app in `app-react/`
- Target isolated route first: `/app-react/`
- Preserve Supabase-native and hybrid workspace behavior while moving shell/auth/workspace boot and Connected Accounts first
