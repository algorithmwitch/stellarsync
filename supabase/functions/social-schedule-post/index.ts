import { corsHeaders, getAuthUser, getSupabaseServiceClient, json, normalizeProvider, readBody, requireWorkspaceMember } from "../_shared/social.ts";

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
    const status = scheduledFor ? "scheduled" : "draft";
    const { data, error } = await supabase
      .from("scheduled_social_posts")
      .insert({
        workspace_id: workspaceId,
        source_type: "stellar_post",
        source_id: String(body.source_id || "").trim(),
        provider,
        social_account_id: body.social_account_id || null,
        post_payload: body.post_payload || {},
        media_payload: body.media_payload || {},
        scheduled_for: scheduledFor,
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
