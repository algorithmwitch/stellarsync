import { corsHeaders, getAuthUser, getEnv, getSupabaseServiceClient, json, normalizeProvider, randomState, readBody, requireWorkspaceMember, safeRedirect } from "../_shared/social.ts";

function buildAuthUrl(provider: string, state: string) {
  if (provider === "linkedin") {
    const clientId = getEnv("LINKEDIN_CLIENT_ID", true);
    const redirectUri = getEnv("LINKEDIN_REDIRECT_URI", true);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "openid profile email w_member_social",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  if (provider === "instagram") {
    const appId = getEnv("META_APP_ID", true);
    const redirectUri = getEnv("META_REDIRECT_URI", true);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    });
    return `https://www.facebook.com/${getEnv("META_API_VERSION") || "v20.0"}/dialog/oauth?${params.toString()}`;
  }

  if (provider === "threads") {
    const appId = getEnv("THREADS_APP_ID", true);
    const redirectUri = getEnv("THREADS_REDIRECT_URI", true);
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: "threads_basic,threads_content_publish",
    });
    return `https://threads.net/oauth/authorize?${params.toString()}`;
  }

  throw new Error(provider === "bluesky"
    ? "Bluesky OAuth is not implemented in Phase 1. Manual app-password flow will be added server-side later."
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
    const redirectTo = safeRedirect(String(body.redirect_to || ""), "https://stellarsync.app/app/");
    const authUrl = buildAuthUrl(provider, state);

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
    return json({ ok: false, error: err instanceof Error ? err.message : "Auth start failed" }, 400);
  }
});
