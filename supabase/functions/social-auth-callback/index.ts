import { corsHeaders, getEnv, getSupabaseServiceClient, getWorkspaceSlug, normalizeProvider, safeRedirect, scrubSocialAccount, upsertSocialAccount, upsertWorkspaceConnection } from "../_shared/social.ts";

async function exchangeLinkedInCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getEnv("LINKEDIN_REDIRECT_URI", true),
    client_id: getEnv("LINKEDIN_CLIENT_ID", true),
    client_secret: getEnv("LINKEDIN_CLIENT_SECRET", true),
  });
  const tokenResp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = await tokenResp.json();
  if (!tokenResp.ok) throw new Error(tokenData.error_description || tokenData.error || "LinkedIn token exchange failed");

  const profileResp = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResp.json();
  if (!profileResp.ok) throw new Error(profile.message || "LinkedIn profile fetch failed");
  return { tokenData, profile };
}

async function exchangeMetaCode(provider: string, code: string) {
  const apiVersion = getEnv("META_API_VERSION") || "v20.0";
  const redirectUri = provider === "threads" ? getEnv("THREADS_REDIRECT_URI", true) : getEnv("META_REDIRECT_URI", true);
  const clientId = provider === "threads" ? getEnv("THREADS_APP_ID", true) : getEnv("META_APP_ID", true);
  const clientSecret = provider === "threads" ? getEnv("THREADS_APP_SECRET", true) : getEnv("META_APP_SECRET", true);
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
      name: provider === "threads" ? "Threads Account" : "Instagram Account",
      username: "",
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const provider = normalizeProvider(url.searchParams.get("provider"));
  const code = String(url.searchParams.get("code") || "").trim();
  const state = String(url.searchParams.get("state") || "").trim();
  const supabase = getSupabaseServiceClient();
  let fallbackRedirect = "https://stellarsync.app/app/";

  try {
    console.log("[social] callback received", { provider, hasCode: !!code, hasState: !!state });
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
    fallbackRedirect = safeRedirect(stateRow.redirect_to || "", fallbackRedirect);

    const workspaceSlug = await getWorkspaceSlug(supabase, stateRow.workspace_id);
    const exchange = provider === "linkedin"
      ? await exchangeLinkedInCode(code)
      : await exchangeMetaCode(provider, code);

    const tokenData = exchange.tokenData || {};
    const profile = exchange.profile || {};
    const providerUserId = String(profile.sub || profile.id || profile.user_id || "").trim();
    if (!providerUserId) throw new Error("Provider profile did not include a user id");
    const scopes = String(tokenData.scope || "").split(/[,\s]+/).filter(Boolean);
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
      scopes,
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
    });

    await upsertWorkspaceConnection(supabase, stateRow.workspace_id, provider, "connected", {
      account_label: account.display_name || account.provider_username || provider,
      scopes,
      provider_user_id: providerUserId,
      last_connected_at: account.last_connected_at,
      publish_support: "Scheduling scaffold ready. Publishing requires provider approval/setup.",
    });

    await supabase
      .from("social_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", stateRow.id);

    const redirect = new URL(fallbackRedirect);
    redirect.searchParams.set("workspace", workspaceSlug || redirect.searchParams.get("workspace") || "");
    redirect.searchParams.set("connected", provider);
    return Response.redirect(redirect.toString(), 302);
  } catch (err) {
    console.error("[social] callback error", err instanceof Error ? err.message : String(err));
    const redirect = new URL(fallbackRedirect);
    redirect.searchParams.set("social_error", err instanceof Error ? err.message : "callback_failed");
    return Response.redirect(redirect.toString(), 302);
  }
});
