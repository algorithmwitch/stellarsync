import { classifyPostMedia, corsHeaders, getAuthUser, getSupabaseServiceClient, json, normalizeProvider, readBody, requireWorkspaceMember, validatePostForPlatform } from "../_shared/social.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await readBody(req);
    const workspaceId = String(body.workspace_id || "").trim();
    const provider = normalizeProvider(body.provider);
    if (!workspaceId || !provider) return json({ ok: false, error: "Missing workspace_id or provider" }, 400);

    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);

    const scheduledFor = body.scheduled_for ? new Date(String(body.scheduled_for)).toISOString() : null;
    const postPayload = (body.post_payload || {}) as Record<string, unknown>;
    const mediaPayload = (body.media_payload || {}) as Record<string, unknown>;
    const caption = String(body.caption || postPayload.caption || postPayload.description || "").trim();
    const mediaUrls = (Array.isArray(body.media_urls) ? body.media_urls : Array.isArray(mediaPayload.media_urls) ? mediaPayload.media_urls : []).map(String);
    const media = Array.isArray(mediaPayload.media) ? mediaPayload.media : mediaUrls.map((url) => ({ media_url: url }));
    const classification = classifyPostMedia({ caption, media_urls: mediaUrls }, { media });
    const validation = validatePostForPlatform({ caption, media_urls: mediaUrls }, provider, { media });
    const status = validation.valid ? (scheduledFor ? "queued" : "draft_queue") : (validation.code.includes("media") || validation.code.includes("video") || validation.code.includes("document") ? "invalid_media" : "validation_failed");
    const { data, error } = await supabase
      .from("scheduled_social_posts")
      .insert({
        workspace_id: workspaceId,
        source_type: "stellar_post",
        source_id: String(body.source_id || "").trim(),
        provider,
        platform: provider,
        social_account_id: body.social_account_id || null,
        post_payload: postPayload,
        media_payload: mediaPayload,
        post_id: String(body.post_id || body.source_id || "").trim(),
        caption,
        media_urls: mediaUrls,
        post_type: classification.classification,
        validation_errors: {
          validation,
          classification: classification.classification,
          errors: validation.severity === "error" ? [validation.message] : [],
          warnings: validation.severity === "warning" ? [validation.message] : [],
        },
        social_provider_strategy: "native",
        aggregator_provider: "none",
        scheduled_for: scheduledFor,
        scheduled_at: scheduledFor,
        status,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) throw error;

    console.log("[social] schedule created", { workspace_id: workspaceId, provider, scheduled_post_id: data.id });
    return json({ ok: true, scheduled_post: data });
  } catch (err) {
    console.error("[social] schedule error", err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: err instanceof Error ? err.message : "Schedule failed" }, 400);
  }
});
