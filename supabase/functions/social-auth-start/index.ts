import { corsHeaders, getAuthUser, getEnv, getEnvAny, getMissingSocialSecrets, getPublicWebappBaseUrl, getSocialCallbackUrl, getSupabaseServiceClient, getWorkspaceSocialCredentials, json, normalizeProvider, randomState, readBody, requireWorkspaceMember, safeRedirect } from "../_shared/social.ts";

async function buildAuthUrl(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string, provider: string, state: string) {
  const workspaceCredentials = await getWorkspaceSocialCredentials(supabase, workspaceId, provider);
  const missingSecrets = workspaceCredentials.missingSetupKeys.length ? workspaceCredentials.missingSetupKeys : getMissingSocialSecrets(provider);
  if (missingSecrets.length) {
    const err = new Error(`Missing Supabase Secret: ${missingSecrets.join(", ")}`);
    (err as Error & { missingSetupKeys?: string[] }).missingSetupKeys = missingSecrets;
    throw err;
  }

  if (provider === "linkedin") {
    const clientId = workspaceCredentials.clientId || getEnv("LINKEDIN_CLIENT_ID", true);
    const redirectUri = getSocialCallbackUrl(provider);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "openid profile email w_member_social",
    });
    console.log("[social-connect] using supabase edge", { provider, workspace_id: workspaceId, app_source: workspaceCredentials.appSource });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  if (provider === "facebook" || provider === "instagram") {
    const appId = getEnvAny(["META_CLIENT_ID", "META_APP_ID", provider === "facebook" ? "FACEBOOK_CLIENT_ID" : "INSTAGRAM_CLIENT_ID"], true);
    const redirectUri = getSocialCallbackUrl(provider);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: provider === "facebook"
        ? "pages_show_list,pages_read_engagement,pages_manage_posts"
        : "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    });
    return `https://www.facebook.com/${getEnv("META_API_VERSION") || "v20.0"}/dialog/oauth?${params.toString()}`;
  }

  if (provider === "threads") {
    const appId = getEnvAny(["META_CLIENT_ID", "THREADS_CLIENT_ID", "THREADS_APP_ID", "META_APP_ID"], true);
    const redirectUri = getSocialCallbackUrl(provider);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: "threads_basic,threads_content_publish",
    });
    return `https://threads.net/oauth/authorize?${params.toString()}`;
  }

  if (provider === "tiktok") {
    const clientKey = getEnv("TIKTOK_CLIENT_KEY", true);
    const redirectUri = getSocialCallbackUrl(provider);
    const params = new URLSearchParams({
      client_key: clientKey,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: "user.info.basic,video.publish,video.upload",
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  throw new Error(provider === "bluesky"
    ? "Bluesky OAuth is not implemented. Use the server-side app-password flow; never store Bluesky credentials in localStorage."
    : "Unsupported provider");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    console.log("[social] auth start");
    const body = await readBody(req);
    const provider = normalizeProvider(body.provider);
    const workspaceId = String(body.workspace_id || "").trim();
    if (!provider || !workspaceId) return json({ ok: false, error: "Missing provider or workspace_id" }, 400);

    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);

    const state = randomState();
    const redirectTo = safeRedirect(String(body.redirect_to || ""), `${getPublicWebappBaseUrl() || "https://stellarsync.app"}/app/`);
    const authUrl = await buildAuthUrl(supabase, workspaceId, provider, state);

    const { error } = await supabase.from("social_oauth_states").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      provider,
      state,
      redirect_to: redirectTo,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    if (error) throw error;

    return json({ ok: true, provider, authUrl });
  } catch (err) {
    console.error("[social] auth start error", err instanceof Error ? err.message : String(err));
    return json({
      ok: false,
      error: err instanceof Error ? err.message : "Auth start failed",
      missingSetupKeys: (err as Error & { missingSetupKeys?: string[] }).missingSetupKeys || [],
    }, 400);
  }
});
