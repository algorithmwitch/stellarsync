import { capabilitiesForPlan, connectionProviders, corsHeaders, getAuthUser, getMissingSocialSecrets, getRequiredSocialSecrets, getSupabaseServiceClient, json, readBody, requireWorkspaceMember, scrubSocialAccount, socialProviders } from "../_shared/social.ts";

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

    const { data: settings } = await supabase
      .from("workspace_settings")
      .select("plan_slug,subscription_tier,managed_account,linkedin_company_publishing_status,linkedin_app_source")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    const planCapabilities = capabilitiesForPlan(settings?.plan_slug || settings?.subscription_tier || (settings?.managed_account ? "managed" : "starter"));

	    console.log("[social] connection status loaded", { workspace_id: workspaceId, accounts: accounts?.length || 0 });
	    const accountsByProvider = new Map<string, Record<string, unknown>>();
    for (const account of accounts || []) {
      const provider = String(account.provider || "");
      const existing = accountsByProvider.get(provider);
      if (!existing || String(account.account_type || "member") === "member") accountsByProvider.set(provider, account);
    }
	    const socialAccountStatuses = socialProviders.map((provider) => {
	      const account = accountsByProvider.get(provider);
      if (provider === "linkedin" && account) console.log("[linkedin-status] account row found");
      const organizationAccount = provider === "linkedin"
        ? (accounts || []).find((item) => String(item.provider || "") === "linkedin" && String(item.account_type || "") === "organization")
        : null;
	      const missingSetupKeys = getMissingSocialSecrets(provider);
      const scopes = Array.isArray(account?.scopes_granted) && account?.scopes_granted.length
        ? account.scopes_granted
        : Array.isArray(account?.scopes)
        ? account.scopes
        : [];
      const canCompanyPublish = !!planCapabilities.company_page_publishing;
      const companyPublishingStatus = String(settings?.linkedin_company_publishing_status || (canCompanyPublish ? "pending_approval" : "unavailable"));
      const organizationName = String(organizationAccount?.organization_name || account?.organization_name || "");
      const organizationUrn = String(organizationAccount?.organization_urn || account?.organization_urn || "");
      const companyConnectionStatusLabel = provider !== "linkedin"
        ? ""
        : organizationName
        ? `Connected to Page: ${organizationName}`
        : !canCompanyPublish
        ? "Organization permissions unavailable / pending approval"
        : companyPublishingStatus === "approved"
        ? "Company Page not selected"
        : "Company Page publishing pending platform approval";
	      return {
	        ...(account ? scrubSocialAccount(account) : {}),
        platform: provider,
        provider,
	        connected: !!account && account.access_status === "connected",
	        accessStatus: account?.access_status || "not_connected",
        connectionStatusLabel: provider === "linkedin" && account ? "Connected as member" : account ? "Connected" : "Not Connected",
	        tokenStatus: account?.token_status || "missing",
        accountLabel: account?.display_name || account?.provider_username || "",
        username: account?.provider_username || "",
        displayName: account?.display_name || "",
	        scopes,
	        requiredScopes: provider === "linkedin" ? ["openid", "profile", "email", "w_member_social"] : scopes,
        scopesGranted: scopes,
	        lastSyncAt: account?.last_sync_at || "",
        tokenExpiresAt: account?.expires_at || "",
        lastError: account?.last_error || "",
	        publishSupported: provider === "linkedin"
          ? !!account && account.access_status === "connected" && missingSetupKeys.length === 0
          : !!account && account.access_status === "connected" && missingSetupKeys.length === 0,
	        publishSupportLabel: provider === "linkedin"
          ? account
            ? "Personal profile publishing where supported."
            : "Connect LinkedIn for personal/member publishing."
          : missingSetupKeys.length ? "Requires setup" : account ? "Native publishing scaffold" : "Requires connection",
	        requiredSetupKeys: getRequiredSocialSecrets(provider),
	        missingSetupKeys,
        accountType: account?.account_type || "member",
        memberUrn: account?.member_urn || "",
        organizationUrn,
        organizationName,
        companyPublishingStatus,
        companyConnectionStatusLabel,
        appSource: account?.app_source || settings?.linkedin_app_source || "stellar_hosted",
        capabilities: provider === "linkedin" ? {
          personal_profile_publishing: true,
          company_page_publishing: canCompanyPublish,
          managed_api_setup: !!planCapabilities.managed_api_setup,
        } : undefined,
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
