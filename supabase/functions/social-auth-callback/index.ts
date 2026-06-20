import { corsHeaders, getEnv, getEnvAny, getPublicWebappBaseUrl, getSocialCallbackUrl, getSupabaseServiceClient, getWorkspaceSocialCredentials, getWorkspaceSlug, json, normalizeProvider, readBody, safeRedirect, upsertSocialAccount, upsertWorkspaceConnection } from "../_shared/social.ts";

async function exchangeLinkedInCode(code: string, clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getSocialCallbackUrl("linkedin"),
    client_id: clientId,
    client_secret: clientSecret,
  });
  const tokenResp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = await tokenResp.json();
  if (!tokenResp.ok) throw new Error(tokenData.error_description || tokenData.error || "LinkedIn token exchange failed");
  console.log("[linkedin-callback] token exchange ok");

  const profileResp = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResp.json();
  if (!profileResp.ok) throw new Error(profile.message || "LinkedIn profile fetch failed");
  return { tokenData, profile };
}

async function exchangeMetaCode(provider: string, code: string) {
  const apiVersion = getEnv("META_API_VERSION") || "v20.0";
  const redirectUri = getSocialCallbackUrl(provider);
  const clientId = provider === "threads"
    ? getEnvAny(["META_CLIENT_ID", "THREADS_CLIENT_ID", "THREADS_APP_ID", "META_APP_ID"], true)
    : getEnvAny(["META_CLIENT_ID", "META_APP_ID", provider === "facebook" ? "FACEBOOK_CLIENT_ID" : "INSTAGRAM_CLIENT_ID"], true);
  const clientSecret = provider === "threads"
    ? getEnvAny(["META_CLIENT_SECRET", "THREADS_CLIENT_SECRET", "THREADS_APP_SECRET", "META_APP_SECRET"], true)
    : getEnvAny(["META_CLIENT_SECRET", "META_APP_SECRET", provider === "facebook" ? "FACEBOOK_CLIENT_SECRET" : "INSTAGRAM_CLIENT_SECRET"], true);
  const endpoint = provider === "threads"
    ? "https://graph.threads.net/oauth/access_token"
    : `https://graph.facebook.com/${apiVersion}/oauth/access_token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const tokenResp = await fetch(`${endpoint}?${params.toString()}`);
  const tokenData = await tokenResp.json();
  if (!tokenResp.ok) throw new Error(tokenData.error?.message || tokenData.error_message || `${provider} token exchange failed`);
  return {
    tokenData,
    profile: {
      id: tokenData.user_id || tokenData.id || `${provider}_${crypto.randomUUID()}`,
      name: provider === "threads" ? "Threads Account" : provider === "facebook" ? "Facebook Page Account" : "Instagram Account",
      username: "",
    },
  };
}

async function exchangeTikTokCode(code: string) {
  const body = new URLSearchParams({
    client_key: getEnv("TIKTOK_CLIENT_KEY", true),
    client_secret: getEnv("TIKTOK_CLIENT_SECRET", true),
    code,
    grant_type: "authorization_code",
    redirect_uri: getSocialCallbackUrl("tiktok"),
  });
  const tokenResp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = await tokenResp.json();
  if (!tokenResp.ok) throw new Error(tokenData.error_description || tokenData.error || "TikTok token exchange failed");

  const profileResp = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profileData = await profileResp.json();
  if (!profileResp.ok) throw new Error(profileData.error?.message || "TikTok profile fetch failed");
  const user = profileData?.data?.user || {};
  return {
    tokenData,
    profile: {
      id: user.open_id || tokenData.open_id,
      name: user.display_name || "TikTok Account",
      username: user.union_id || "",
      picture: user.avatar_url || "",
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const body = req.method === "POST" ? await readBody(req) : {};
  let provider = normalizeProvider(url.searchParams.get("provider") || body.provider || "");
  const code = String(url.searchParams.get("code") || body.code || "").trim();
  const state = String(url.searchParams.get("state") || body.state || "").trim();
  const jsonMode = url.searchParams.get("json") === "true" || body.json === true;
  const supabase = getSupabaseServiceClient();
  let fallbackRedirect = `${getPublicWebappBaseUrl() || "https://stellarsync.app"}/app/`;

  try {
    if (!provider && state) {
      const { data: stateRow } = await supabase
        .from("social_oauth_states")
        .select("provider")
        .eq("state", state)
        .maybeSingle();
      if (stateRow?.provider) provider = normalizeProvider(stateRow.provider);
    }

    console.log("[social] callback received", { provider, hasCode: !!code, hasState: !!state, jsonMode });
    if (!provider || !code || !state) throw new Error("Missing provider, code, or state");

    const { data: stateRow, error: stateError } = await supabase
      .from("social_oauth_states")
      .select("*")
      .eq("state", state)
      .eq("provider", provider)
      .maybeSingle();
    if (stateError) throw stateError;
	    if (!stateRow || stateRow.consumed_at) throw new Error("Invalid or consumed OAuth state");
	    if (new Date(stateRow.expires_at).getTime() < Date.now()) throw new Error("OAuth state expired");
    if (provider === "linkedin") console.log("[linkedin-callback] state found");
	    fallbackRedirect = safeRedirect(stateRow.redirect_to || "", fallbackRedirect);

	    const workspaceSlug = await getWorkspaceSlug(supabase, stateRow.workspace_id);
    const credentials = await getWorkspaceSocialCredentials(supabase, stateRow.workspace_id, provider);
    if (credentials.missingSetupKeys.length) throw new Error(`Missing Supabase Secret: ${credentials.missingSetupKeys.join(", ")}`);
	    const exchange = provider === "linkedin"
	      ? await exchangeLinkedInCode(code, credentials.clientId, credentials.clientSecret)
      : provider === "tiktok"
      ? await exchangeTikTokCode(code)
      : await exchangeMetaCode(provider, code);

    const tokenData = exchange.tokenData || {};
    const profile = exchange.profile || {};
    const providerUserId = String(profile.sub || profile.id || profile.user_id || "").trim();
    if (!providerUserId) throw new Error("Provider profile did not include a user id");
	    const scopes = String(tokenData.scope || "").split(/[,\s]+/).filter(Boolean);
    const grantedScopes = scopes.length ? scopes : provider === "linkedin" ? ["openid", "profile", "email", "w_member_social"] : [];
	    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    const account = await upsertSocialAccount(supabase, {
      workspace_id: stateRow.workspace_id,
      provider,
      provider_user_id: providerUserId,
      provider_username: profile.preferred_username || profile.username || "",
      display_name: profile.name || profile.localizedFirstName || provider,
      avatar_url: profile.picture || "",
	      access_status: "connected",
	      token_status: "active",
	      scopes: grantedScopes,
      account_type: "member",
      member_urn: provider === "linkedin" ? `urn:li:person:${providerUserId}` : null,
      organization_urn: null,
      organization_name: null,
      scopes_granted: grantedScopes,
      app_source: credentials.appSource,
	      expires_at: expiresAt,
      last_connected_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      last_error: null,
      metadata: {
        profile,
        token_data: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type,
          expires_in: tokenData.expires_in,
          scope: tokenData.scope,
        },
      },
      social_provider_strategy: "native",
      aggregator_provider: "none",
	    });
    if (provider === "linkedin") console.log("[linkedin-callback] account upsert ok");

	    await upsertWorkspaceConnection(supabase, stateRow.workspace_id, provider, "connected", {
	      account_label: account.display_name || account.provider_username || provider,
	      scopes: grantedScopes,
	      provider_user_id: providerUserId,
	      last_connected_at: account.last_connected_at,
      app_source: credentials.appSource,
	      publish_support: provider === "linkedin"
          ? "LinkedIn connected for personal/member publishing. Company Page publishing requires Managed setup and LinkedIn Community Management approval."
          : "Scheduling scaffold ready. Publishing requires provider approval/setup.",
	    });

    await supabase
      .from("social_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", stateRow.id);

    const redirect = new URL(fallbackRedirect);
	    redirect.searchParams.set("workspace", workspaceSlug || redirect.searchParams.get("workspace") || "");
	    redirect.searchParams.set("connected", provider);
    redirect.searchParams.set("social_success", provider);
    if (jsonMode) return json({ ok: true, redirectUrl: redirect.toString() });
    return Response.redirect(redirect.toString(), 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : "callback_failed";
    console.error("[social] callback error", message);
    const redirect = new URL(fallbackRedirect);
    redirect.searchParams.set("social_error", message);
    if (jsonMode) return json({ ok: false, redirectUrl: redirect.toString(), error: message });
    return Response.redirect(redirect.toString(), 302);
  }
});
