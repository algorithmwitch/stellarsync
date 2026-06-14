import { connectionProviders, corsHeaders, getAuthUser, getSupabaseServiceClient, json, readBody, requireWorkspaceMember, scrubSocialAccount, upsertWorkspaceConnection } from "../_shared/social.ts";

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
    return json({
      ok: true,
      accounts: (accounts || []).map(scrubSocialAccount),
      connections: connections || [],
      message: "Scheduling scaffold ready. Publishing requires provider approval/setup.",
    });
  } catch (err) {
    console.error("[social] connection status error", err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: err instanceof Error ? err.message : "Connection status failed" }, 400);
  }
});
