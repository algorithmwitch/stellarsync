import { corsHeaders, getAuthUser, getSupabaseServiceClient, json, readinessForAccount, readBody, requireWorkspaceMember } from "../_shared/social.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    console.log("[social] publish attempted");
    const body = await readBody(req);
    const workspaceId = String(body.workspace_id || "").trim();
    const scheduledId = String(body.scheduled_social_post_id || "").trim();
    if (!workspaceId || !scheduledId) return json({ ok: false, error: "Missing workspace_id or scheduled_social_post_id" }, 400);

    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);

    const { data: scheduledPost, error: postError } = await supabase
      .from("scheduled_social_posts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", scheduledId)
      .maybeSingle();
    if (postError) throw postError;
    if (!scheduledPost) throw new Error("Scheduled social post not found");

    const { data: account, error: accountError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", scheduledPost.social_account_id)
      .maybeSingle();
    if (accountError) throw accountError;

    const readiness = readinessForAccount(account);
    if (readiness !== "ready") {
      const message = readiness === "publishing_not_implemented"
        ? "Provider publishing not implemented yet"
        : "Provider is not ready for publishing";
      await supabase
        .from("scheduled_social_posts")
        .update({ status: "failed", last_error: message, publish_result: { readiness } })
        .eq("id", scheduledPost.id);
      return json({ ok: false, readiness, error: message }, 400);
    }

    // Phase 1 intentionally does not publish to provider APIs.
    return json({ ok: false, readiness, error: "Provider publishing not implemented yet" }, 400);
  } catch (err) {
    console.error("[social] publish error", err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: err instanceof Error ? err.message : "Publish failed" }, 400);
  }
});
