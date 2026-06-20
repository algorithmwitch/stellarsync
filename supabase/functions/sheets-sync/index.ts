import { corsHeaders, getAuthUser, getSupabaseServiceClient, json, readBody, requireWorkspaceMember } from "../_shared/social.ts";

const TABLES: Record<string, string> = {
  posts: "posts",
  notes: "notes",
  inspo: "inspo",
  ai_drafts: "ai_drafts",
  campaigns: "campaigns",
  media: "media_assets",
  media_attachments: "post_media",
  settings: "workspace_settings",
  brand_framework: "brand_framework",
  schema_notes: "schema_notes",
  ai_chain_settings: "ai_chain_settings",
  flow_event_log: "flow_event_log",
};

const CANONICAL_ID_FIELDS: Record<string, string> = {
  posts: "post_id",
  notes: "note_id",
  inspo: "inspo_id",
  ai_drafts: "ai_draft_id",
  campaigns: "campaign_id",
  media: "media_asset_id",
  media_attachments: "media_attachment_id",
  settings: "workspace_id",
  brand_framework: "framework_key",
  schema_notes: "schema_key",
  ai_chain_settings: "workspace_id",
  flow_event_log: "event_id",
};

async function getWorkspaceSettings(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
) {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function fetchSupabaseRows(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  table: string,
) {
  const supabaseTable = TABLES[table];
  if (!supabaseTable) throw new Error(`Unknown table: ${table}`);
  const idField = CANONICAL_ID_FIELDS[table];
  if (table === "media_attachments") {
    const { data: postMedia, error } = await supabase
      .from("post_media")
      .select("workspace_id,post_id,media_asset_id,sort_order,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    const postIds = Array.from(new Set((postMedia || []).map((row: Record<string, unknown>) => String(row.post_id || "").trim()).filter(Boolean)));
    const assetIds = Array.from(new Set((postMedia || []).map((row: Record<string, unknown>) => String(row.media_asset_id || "").trim()).filter(Boolean)));
    const postsResult = postIds.length
      ? await supabase.from("posts").select("post_id,title,updated_at").eq("workspace_id", workspaceId).in("post_id", postIds)
      : { data: [], error: null };
    const mediaResult = assetIds.length
      ? await supabase.from("media_assets").select("id,asset_id,title,storage_path,filename,media_url,media_type,updated_at").eq("workspace_id", workspaceId).in("id", assetIds)
      : { data: [], error: null };
    if (postsResult.error) throw postsResult.error;
    if (mediaResult.error) throw mediaResult.error;
    const postsById = new Map((postsResult.data || []).map((post: Record<string, unknown>) => [String(post.post_id || "").trim(), post]));
    const mediaById = new Map((mediaResult.data || []).map((asset: Record<string, unknown>) => [String(asset.id || "").trim(), asset]));
    const rows = (postMedia || []).map((row: Record<string, unknown>) => {
      const post = postsById.get(String(row.post_id || "").trim()) || {};
      const media = mediaById.get(String(row.media_asset_id || "").trim()) || {};
      return {
        workspace_id: workspaceId,
        media_attachment_id: `${String(row.post_id || "").trim()}|${String(row.media_asset_id || "").trim()}`,
        post_id: String(row.post_id || "").trim(),
        post_title: String(post.title || "").trim(),
        media_asset_id: String(row.media_asset_id || "").trim(),
        storage_path: String(media.storage_path || "").trim(),
        filename: String(media.filename || media.title || "").trim(),
        media_url: String(media.media_url || "").trim(),
        media_type: String(media.media_type || "").trim(),
        linked_post_title: String(post.title || "").trim(),
        sort_order: Number(row.sort_order || 0) || 0,
        relationship_type: "post_media",
        sync_status: "synced",
        synced_at: new Date().toISOString(),
        sync_error: "",
        updated_at: String(row.updated_at || media.updated_at || post.updated_at || "").trim()
      };
    });
    return { rows, idField };
  }
  if (table === "media") {
    const { data: mediaRows, error } = await supabase
      .from("media_assets")
      .select("id,asset_id,workspace_id,title,filename,media_url,storage_path,media_type,mime_type,alt_text,tags,linked_post_id,post_id,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const postIds = Array.from(new Set((mediaRows || []).map((row: Record<string, unknown>) => String(row.linked_post_id || row.post_id || "").trim()).filter(Boolean)));
    const postsResult = postIds.length
      ? await supabase.from("posts").select("post_id,title").eq("workspace_id", workspaceId).in("post_id", postIds)
      : { data: [], error: null };
    if (postsResult.error) throw postsResult.error;
    const postsById = new Map((postsResult.data || []).map((post: Record<string, unknown>) => [String(post.post_id || "").trim(), post]));
    const rows = (mediaRows || []).map((row: Record<string, unknown>) => {
      const post = postsById.get(String(row.linked_post_id || row.post_id || "").trim()) || {};
      return {
        workspace_id: workspaceId,
        media_asset_id: String(row.id || row.asset_id || "").trim(),
        title: String(row.title || row.filename || "").trim(),
        filename: String(row.filename || "").trim(),
        media_url: String(row.media_url || "").trim(),
        storage_path: String(row.storage_path || "").trim(),
        media_type: String(row.media_type || "").trim(),
        mime_type: String(row.mime_type || "").trim(),
        alt_text: String(row.alt_text || "").trim(),
        tags: Array.isArray(row.tags) ? row.tags.join(", ") : String(row.tags || "").trim(),
        linked_post_id: String(row.linked_post_id || row.post_id || "").trim(),
        linked_post_title: String(post.title || "").trim(),
        created_at: String(row.created_at || "").trim(),
        updated_at: String(row.updated_at || "").trim(),
        sync_status: "synced",
        synced_at: new Date().toISOString(),
        sync_error: ""
      };
    });
    return { rows, idField };
  }
  const { data, error } = await supabase
    .from(supabaseTable)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return { rows: data || [], idField };
}

async function upsertSupabaseRows(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  table: string,
  rows: Record<string, unknown>[],
) {
  const supabaseTable = TABLES[table];
  if (!supabaseTable) throw new Error(`Unknown table: ${table}`);
  const idField = CANONICAL_ID_FIELDS[table];
  if (!idField) throw new Error(`No canonical id field for ${table}`);
  if (table === "media_attachments") {
    const grouped = new Map<string, Array<Record<string, unknown>>>();
    for (const row of rows) {
      const postId = String(row.post_id || row.postId || "").trim();
      const mediaAssetId = String(row.media_asset_id || row.mediaAssetId || row.id || "").trim();
      if (!postId || !mediaAssetId) continue;
      if (!grouped.has(postId)) grouped.set(postId, []);
      grouped.get(postId)!.push({ ...row, post_id: postId, media_asset_id: mediaAssetId, sort_order: Number(row.sort_order ?? row.sortOrder ?? 0) || 0 });
    }
    let upserted = 0;
    const errors: Record<string, unknown>[] = [];
    for (const [postId, groupedRows] of grouped.entries()) {
      groupedRows.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      const orderedIds = groupedRows.map((row) => String(row.media_asset_id || "").trim()).filter(Boolean);
      for (const row of groupedRows) {
        const { error } = await supabase.from("post_media").upsert({
          workspace_id: workspaceId,
          post_id: postId,
          media_asset_id: String(row.media_asset_id || "").trim(),
          sort_order: Number(row.sort_order || 0) || 0,
        }, { onConflict: "workspace_id,post_id,media_asset_id" });
        if (error) errors.push({ post_id: postId, media_asset_id: row.media_asset_id, error: error.message });
        else upserted++;
      }
      if (orderedIds.length) {
        await supabase.from("posts").update({ media_ids: orderedIds, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("post_id", postId).catch(() => null);
        await supabase.from("media_assets").update({ linked_post_id: postId, post_id: postId }).eq("workspace_id", workspaceId).in("id", orderedIds).catch(() => null);
      }
    }
    return { upserted, errors, refreshed: [], idField };
  }
  const now = new Date().toISOString();
  let upserted = 0;
  let errors: Record<string, unknown>[] = [];
  for (const row of rows) {
    const canonicalId = String(row[idField] || "").trim();
    if (!canonicalId) continue;
    const payload = { ...row, workspace_id: workspaceId, updated_at: now };
    delete payload.sync_status;
    delete payload.synced_at;
    delete payload.sync_error;
    if (table === "media") {
      delete payload.linked_post_title;
    }
    const { error } = await supabase
      .from(supabaseTable)
      .upsert(payload, { onConflict: `workspace_id,${idField}` });
    if (error) {
      errors.push({ [idField]: canonicalId, error: error.message });
    } else {
      upserted++;
    }
  }
  const { data: refreshed, error: refreshError } = await supabase
    .from(supabaseTable)
    .select("*")
    .eq("workspace_id", workspaceId);
  if (refreshError) throw refreshError;
  return { upserted, errors, refreshed: refreshed || [], idField };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const user = await getAuthUser(req);
    const body = await readBody(req);
    const action = String(body.action || "").trim().toLowerCase();
    const workspaceId = String(body.workspace_id || "").trim();
    if (!workspaceId) return json({ ok: false, error: "Missing workspace_id" }, 400);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);
    const settings = await getWorkspaceSettings(supabase, workspaceId);
    const backendType = String(settings?.backend_type || body.backend_type || "").trim().toLowerCase();
    if (action === "fetch_supabase") {
      const table = String(body.table || "").trim().toLowerCase();
      if (!table) return json({ ok: false, error: "Missing table" }, 400);
      const result = await fetchSupabaseRows(supabase, workspaceId, table);
      return json({ ok: true, ...result });
    }
    if (action === "upsert_supabase") {
      const table = String(body.table || "").trim().toLowerCase();
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!table || !rows.length) return json({ ok: false, error: "Missing table or rows" }, 400);
      const result = await upsertSupabaseRows(supabase, workspaceId, table, rows);
      return json({ ok: true, ...result });
    }
    if (action === "push_all") {
      const tables = Object.keys(TABLES);
      const results: Record<string, unknown> = {};
      for (const table of tables) {
        try {
          const fetched = await fetchSupabaseRows(supabase, workspaceId, table);
          if (table === "media") console.log("[sheets-sync] media assets count", fetched.rows.length);
          if (table === "media_attachments") console.log("[sheets-sync] media attachments count", fetched.rows.length);
          results[table] = { ok: true, count: fetched.rows.length };
        } catch (err) {
          results[table] = { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }
      console.log("[sheets-sync] push result", results);
      return json({ ok: true, action: "push_all", workspace_id: workspaceId, results });
    }
    if (action === "settings") {
      return json({ ok: true, settings, backend_type: backendType });
    }
    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sheets-sync] error", err);
    return json({ ok: false, error: message }, 500);
  }
});
