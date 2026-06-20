import { connectionProviders, corsHeaders, getAuthUser, getMissingSocialSecrets, getRequiredSocialSecrets, getSupabaseServiceClient, json, readBody, requireWorkspaceMember, scrubSocialAccount, socialProviders } from "../_shared/social.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await readBody(req);
    const workspaceId = String(body.workspace_id || "").trim();
    if (!workspaceId) return json({ ok: false, error: "Missing workspace_id" }, 400);
    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);

    const { data: accounts, error: accountsError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("workspace_id", workspaceId);
    if (accountsError) throw accountsError;

    const { data: connections, error: connectionsError } = await supabase
      .from("workspace_connections")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("provider", [...connectionProviders]);
    if (connectionsError) throw connectionsError;

    console.log("[social] connection status loaded", { workspace_id: workspaceId, accounts: accounts?.length || 0 });
    const accountsByProvider = new Map((accounts || []).map((account) => [String(account.provider || ""), account]));
    const socialAccountStatuses = socialProviders.map((provider) => {
      const account = accountsByProvider.get(provider);
      const missingSetupKeys = getMissingSocialSecrets(provider);
      return {
        ...(account ? scrubSocialAccount(account) : {}),
        platform: provider,
        provider,
        connected: !!account && account.access_status === "connected",
        accessStatus: account?.access_status || "not_connected",
        tokenStatus: account?.token_status || "missing",
        accountLabel: account?.display_name || account?.provider_username || "",
        username: account?.provider_username || "",
        displayName: account?.display_name || "",
        scopes: account?.scopes || [],
        requiredScopes: account?.scopes || [],
        lastSyncAt: account?.last_sync_at || "",
        tokenExpiresAt: account?.expires_at || "",
        lastError: account?.last_error || "",
        publishSupported: !!account && account.access_status === "connected" && missingSetupKeys.length === 0,
        publishSupportLabel: missingSetupKeys.length ? "Requires setup" : account ? "Native publishing scaffold" : "Requires connection",
        requiredSetupKeys: getRequiredSocialSecrets(provider),
        missingSetupKeys,
      };
    });

    return json({
      ok: true,
      accounts: socialAccountStatuses,
      connections: connections || [],
      message: "Scheduling scaffold ready. Publishing requires provider approval/setup.",
    });
  } catch (err) {
    console.error("[social] connection status error", err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: err instanceof Error ? err.message : "Connection status failed" }, 400);
  }
});
