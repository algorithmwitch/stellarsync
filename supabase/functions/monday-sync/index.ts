import { corsHeaders, getAuthUser, getEnv, getSupabaseServiceClient, json, readBody, requireWorkspaceMember, upsertWorkspaceConnection } from "../_shared/social.ts";

type MondayColumn = { id: string; title: string; type: string; settings_str?: string };

async function getWorkspaceMondayBoardId(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string, fallback = "") {
  if (fallback) return fallback;
  const { data, error } = await supabase
    .from("workspaces")
    .select("monday_board_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return String(data?.monday_board_id || "").trim();
}

async function fetchMondayBoard(token: string, boardId: string) {
  const mondayResp = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "query ($ids: [ID!]) { boards(ids: $ids) { id name state columns { id title type settings_str } } }",
      variables: { ids: [boardId] },
    }),
  });
  const mondayData = await mondayResp.json();
  if (!mondayResp.ok || mondayData.errors) {
    throw new Error(mondayData.errors?.[0]?.message || "Monday board access failed");
  }
  const board = mondayData.data?.boards?.[0] || null;
  if (!board) throw new Error("Monday board not found");
  return board;
}

function normalizeLabel(value: string) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveColumn(columns: MondayColumn[], aliases: string[], allowedTypes: string[]) {
  const normalizedAliases = aliases.map(normalizeLabel);
  return columns.find((column) => {
    const title = normalizeLabel(column.title);
    const typeOk = !allowedTypes.length || allowedTypes.includes(String(column.type || "").toLowerCase());
    return typeOk && normalizedAliases.some((alias) => title === alias || title.includes(alias));
  }) || null;
}

function buildMondayColumnMapping(columns: MondayColumn[]) {
  const mapping = {
    description: resolveColumn(columns, ["description", "copy", "caption", "post description"], ["long_text", "text"]),
    date: resolveColumn(columns, ["date", "publish date", "scheduled date", "planning date"], ["date"]),
    status: resolveColumn(columns, ["status", "publish status", "stage"], ["status"]),
    platform: resolveColumn(columns, ["platform", "platforms", "channel", "channels"], ["dropdown", "text"]),
    url: resolveColumn(columns, ["url", "published url", "link", "post url"], ["link", "text"]),
    campaign: resolveColumn(columns, ["campaign", "campaign name"], ["text", "dropdown"]),
  };
  const missing = Object.entries(mapping).filter(([, column]) => !column).map(([key]) => key);
  const used = Object.fromEntries(Object.entries(mapping).filter(([, column]) => !!column).map(([key, column]) => [key, { id: column!.id, title: column!.title, type: column!.type }]));
  return { mapping, missing, used };
}

function mondayValueForColumn(column: MondayColumn, rawValue: string) {
  const value = String(rawValue || "").trim();
  if (!value) return undefined;
  const type = String(column.type || "").toLowerCase();
  if (type === "date") return { date: value.slice(0, 10) };
  if (type === "status") return { label: value };
  if (type === "dropdown") return { labels: value.split(/[,|]/).map((item) => item.trim()).filter(Boolean) };
  if (type === "link") return { url: value, text: value };
  return value;
}

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

    if (action === "test" || action === "inspect_columns") {
      console.log("[monday] board test started");
      const { data: connection, error: connError } = await supabase
        .from("workspace_connections")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("provider", "monday")
        .maybeSingle();
      if (connError) throw connError;

      const boardId = await getWorkspaceMondayBoardId(
        supabase,
        workspaceId,
        String(body.board_id || connection?.config?.board_id || connection?.config?.monday_board_id || connection?.metadata?.board_id || connection?.metadata?.monday_board_id || "").trim()
      );
      if (!boardId) throw new Error("Missing monday board_id");

      const board = await fetchMondayBoard(token, boardId);
      const columns = (board.columns || []) as MondayColumn[];
      const mapped = buildMondayColumnMapping(columns);

      await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
        board_id: board.id,
        board_name: board.name,
        state: board.state,
        columns_found: columns,
        columns_used: mapped.used,
        missing_columns: mapped.missing,
        last_sync_at: new Date().toISOString(),
      });
      console.log("[monday] board test success", { workspace_id: workspaceId, board_id: board.id });
      return json({
        ok: true,
        board: { id: board.id, name: board.name, state: board.state },
        board_id: board.id,
        board_name: board.name,
        columns,
        columns_found: columns,
        columns_used: mapped.used,
        missing_columns: mapped.missing
      });

    } else if (action === "sync_post") {
      console.log("[monday] sync_post started");
      const boardId = await getWorkspaceMondayBoardId(supabase, workspaceId, String(body.board_id || "").trim());
      if (!boardId) throw new Error("Missing monday board_id");
      const board = await fetchMondayBoard(token, boardId);
      const columns = (board.columns || []) as MondayColumn[];
      const mapped = buildMondayColumnMapping(columns);

      const postTitle = String(body.post_title || "").trim();
      const postDescription = String(body.post_description || "").trim();
      const postDate = String(body.post_date || "").trim();
      const postPlatform = String(body.post_platform || "").trim();
      const postStatus = String(body.post_status || "draft").trim();
      const postUrl = String(body.post_url || "").trim();
      const postCampaign = String(body.post_campaign || body.campaign_name || "").trim();
      const existingItemId = String(body.monday_item_id || "").trim();

      const columnValues: Record<string, unknown> = {};
      const assignments: Array<[keyof typeof mapped.mapping, string]> = [
        ["description", postDescription],
        ["date", postDate],
        ["status", postStatus],
        ["platform", postPlatform],
        ["url", postUrl],
        ["campaign", postCampaign],
      ];
      for (const [key, value] of assignments) {
        const column = mapped.mapping[key];
        if (!column) continue;
        const mondayValue = mondayValueForColumn(column, value);
        if (mondayValue !== undefined) columnValues[column.id] = mondayValue;
      }

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
          const mondayError = mondayData.errors?.[0]?.message || "Monday item update failed";
          return json({
            ok: false,
            error: mondayError,
            monday_error: mondayError,
            diagnostics: {
              board_id: boardId,
              board_name: board.name,
              columns_found: columns,
              columns_used: mapped.used,
              missing_columns: mapped.missing,
              monday_error: mondayError,
            },
            board_id: boardId,
            board_name: board.name,
            columns_found: columns,
            columns_used: mapped.used,
            missing_columns: mapped.missing,
          }, 400);
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
          const mondayError = mondayData.errors?.[0]?.message || "Monday item creation failed";
          return json({
            ok: false,
            error: mondayError,
            monday_error: mondayError,
            diagnostics: {
              board_id: boardId,
              board_name: board.name,
              columns_found: columns,
              columns_used: mapped.used,
              missing_columns: mapped.missing,
              monday_error: mondayError,
            },
            board_id: boardId,
            board_name: board.name,
            columns_found: columns,
            columns_used: mapped.used,
            missing_columns: mapped.missing,
          }, 400);
        }
        itemId = mondayData.data?.create_item?.id || "";
        if (!itemId) throw new Error("Monday item created but no ID returned");
      }

      const now = new Date().toISOString();
      await upsertWorkspaceConnection(supabase, workspaceId, "monday", "connected", {
        board_id: boardId,
        board_name: board.name,
        columns_found: columns,
        columns_used: mapped.used,
        missing_columns: mapped.missing,
        last_sync_at: now,
      });

      console.log("[monday] sync_post success", { workspace_id: workspaceId, board_id: boardId, item_id: itemId });
      return json({
        ok: true,
        monday_item_id: itemId,
        synced_at: now,
        diagnostics: {
          board_id: boardId,
          board_name: board.name,
          columns_found: columns,
          columns_used: mapped.used,
          missing_columns: mapped.missing,
          monday_error: ""
        },
        board_id: boardId,
        board_name: board.name,
        columns_found: columns,
        columns_used: mapped.used,
        missing_columns: mapped.missing,
        warning: mapped.missing.length ? "Some optional Monday columns were not found; item name/title was still synced." : ""
      });

    } else {
      return json({ ok: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[monday] error", err instanceof Error ? err.message : String(err));
    const message = err instanceof Error ? err.message : "Monday sync failed";
    return json({ ok: false, error: message, monday_error: message }, 400);
  }
});
