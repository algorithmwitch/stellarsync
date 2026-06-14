import { corsHeaders, getAuthUser, getEnv, getSupabaseServiceClient, json, readBody, requireWorkspaceMember, upsertWorkspaceConnection } from "../_shared/social.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await readBody(req);
    const action = String(body.action || "test").trim();
    const workspaceId = String(body.workspace_id || "").trim();
    if (!workspaceId) return json({ ok: false, error: "Missing workspace_id" }, 400);

    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);

    const token = getEnv("MONDAY_API_TOKEN", true);

    if (action === "test") {
      console.log("[monday] board test started");
      const { data: connection, error: connError } = await supabase
        .from("workspace_connections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("provider", "monday")
        .maybeSingle();
      if (connError) throw connError;

      const boardId = String(body.board_id || connection?.config?.board_id || "").trim();
      if (!boardId) throw new Error("Missing monday board_id");

      const mondayResp = await fetch("https://api.monday.com/v2", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: "query ($ids: [ID!]) { boards(ids: $ids) { id name state } }",
          variables: { ids: [boardId] },
        }),
      });
      const mondayData = await mondayResp.json();
      if (!mondayResp.ok || mondayData.errors) {
        throw new Error(mondayData.errors?.[0]?.message || "Monday board access failed");
      }
      const board = mondayData.data?.boards?.[0] || null;
      if (!board) throw new Error("Monday board not found");

      await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
        board_id: board.id,
        board_name: board.name,
        state: board.state,
        last_sync_at: new Date().toISOString(),
      });
      console.log("[monday] board test success", { workspace_id: workspaceId, board_id: board.id });
      return json({ ok: true, board });

    } else if (action === "sync_post") {
      console.log("[monday] sync_post started");
      const boardId = String(body.board_id || "").trim();
      if (!boardId) throw new Error("Missing monday board_id");

      const postTitle = String(body.post_title || "").trim();
      const postDescription = String(body.post_description || "").trim();
      const postDate = String(body.post_date || "").trim();
      const postPlatform = String(body.post_platform || "").trim();
      const postStatus = String(body.post_status || "draft").trim();
      const postUrl = String(body.post_url || "").trim();
      const existingItemId = String(body.monday_item_id || "").trim();

      const columnValues: Record<string, string> = {};
      if (postTitle) columnValues.title = postTitle;
      if (postDescription) columnValues.text = postDescription;
      if (postDate) columnValues.date = postDate;
      if (postPlatform) columnValues.platform = postPlatform;
      if (postStatus) columnValues.status = postStatus;
      if (postUrl) columnValues.link = postUrl;

      let itemId = existingItemId;

      if (itemId) {
        const mondayResp = await fetch("https://api.monday.com/v2", {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
              mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
                change_multiple_column_values(
                  board_id: $boardId,
                  item_id: $itemId,
                  column_values: $columnValues
                ) { id }
              }
            `,
            variables: {
              boardId,
              itemId,
              columnValues: JSON.stringify(columnValues),
            },
          }),
        });
        const mondayData = await mondayResp.json();
        if (!mondayResp.ok || mondayData.errors) {
          throw new Error(mondayData.errors?.[0]?.message || "Monday item update failed");
        }
      } else {
        const mondayResp = await fetch("https://api.monday.com/v2", {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
              mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
                create_item(
                  board_id: $boardId,
                  item_name: $itemName,
                  column_values: $columnValues
                ) { id }
              }
            `,
            variables: {
              boardId,
              itemName: postTitle || "StellarSync Post",
              columnValues: JSON.stringify(columnValues),
            },
          }),
        });
        const mondayData = await mondayResp.json();
        if (!mondayResp.ok || mondayData.errors) {
          throw new Error(mondayData.errors?.[0]?.message || "Monday item creation failed");
        }
        itemId = mondayData.data?.create_item?.id || "";
        if (!itemId) throw new Error("Monday item created but no ID returned");
      }

      const now = new Date().toISOString();
      await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
        board_id: boardId,
        last_sync_at: now,
      });

      console.log("[monday] sync_post success", { workspace_id: workspaceId, board_id: boardId, item_id: itemId });
      return json({ ok: true, monday_item_id: itemId, synced_at: now });

    } else {
      return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[monday] error", err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: err instanceof Error ? err.message : "Monday sync failed" }, 400);
  }
});
