import { corsHeaders, getAuthUser, getSupabaseServiceClient, json, readBody, requireWorkspaceMember } from "../_shared/social.ts";

type MediaAsset = Record<string, unknown>;

const DEFAULT_BUCKET = Deno.env.get("SUPABASE_MEDIA_BUCKET") || Deno.env.get("MEDIA_BUCKET") || "media";
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg"]);

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function filenameFromPath(path: string) {
  return path.split("/").filter(Boolean).pop() || path;
}

function extensionFromPath(path: string) {
  const filename = filenameFromPath(path);
  const parts = filename.split(".");
  return parts.length > 1 ? String(parts.pop() || "").toLowerCase() : "";
}

function titleFromFilename(filename: string) {
  return filename.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim() || filename || "Untitled media";
}

function inferMediaType(path: string, mimeType = "") {
  const mime = mimeType.toLowerCase();
  const ext = extensionFromPath(path);
  if (mime.startsWith("image/") || IMAGE_EXTENSIONS.has(ext)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(ext)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (mime.includes("pdf") || ext === "pdf") return "document";
  return "file";
}

function assetIdFromPath(bucket: string, path: string) {
  const bytes = new TextEncoder().encode(`${bucket}/${path}`);
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `media_${(hash >>> 0).toString(36)}`;
}

function getFileMime(file: Record<string, unknown>) {
  const metadata = (file.metadata || {}) as Record<string, unknown>;
  return cleanString(file.mimetype || file.mime_type || metadata.mimetype || metadata.mimeType || metadata.contentType);
}

function getFileSize(file: Record<string, unknown>) {
  const metadata = (file.metadata || {}) as Record<string, unknown>;
  const size = Number(file.size || metadata.size || metadata.contentLength || 0);
  return Number.isFinite(size) && size > 0 ? size : null;
}

async function resolveBucket(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string, requestedBucket = "") {
  if (requestedBucket) return requestedBucket;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();
  const workspaceBucket = cleanString(workspace?.media_bucket || workspace?.storage_bucket || workspace?.bucket);
  if (workspaceBucket) return workspaceBucket;

  const { data: connections } = await supabase
    .from("workspace_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("provider", ["media", "supabase_storage", "storage"])
    .limit(1);
  const connection = Array.isArray(connections) ? connections[0] : null;
  const config = (connection?.config || {}) as Record<string, unknown>;
  const metadata = (connection?.metadata || {}) as Record<string, unknown>;
  return cleanString(config.bucket || config.media_bucket || metadata.bucket || metadata.media_bucket) || DEFAULT_BUCKET;
}

async function listStorageFilesRecursive(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  bucket: string,
  prefix = "",
): Promise<Array<Record<string, unknown> & { storage_path: string }>> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;

  const files: Array<Record<string, unknown> & { storage_path: string }> = [];
  for (const item of data || []) {
    const name = cleanString(item.name);
    if (!name) continue;
    const path = prefix ? `${prefix.replace(/\/+$/, "")}/${name}` : name;
    const isFolder = !item.id && !item.metadata && !extensionFromPath(name);
    if (isFolder) {
      files.push(...await listStorageFilesRecursive(supabase, bucket, path));
    } else {
      files.push({ ...(item as Record<string, unknown>), storage_path: path });
    }
  }
  return files;
}

async function resolveAssetUrl(supabase: ReturnType<typeof getSupabaseServiceClient>, bucket: string, path: string) {
  const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signed?.signedUrl) return signed.signedUrl;
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
  return pub.publicUrl || "";
}

async function resolveUrlsForAssets(supabase: ReturnType<typeof getSupabaseServiceClient>, assets: MediaAsset[]) {
  const resolved: MediaAsset[] = [];
  for (const asset of assets || []) {
    const bucket = cleanString(asset.bucket) || DEFAULT_BUCKET;
    const path = cleanString(asset.storage_path);
    let url = cleanString(asset.media_url);
    if (!url && path) url = await resolveAssetUrl(supabase, bucket, path);
    resolved.push({
      ...asset,
      media_url: url,
      url,
      fileUrl: url,
      sourceUrl: url,
      thumbnail_url: cleanString(asset.thumbnail_url) || url,
    });
  }
  return resolved;
}

async function indexBucket(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string, body: Record<string, unknown>) {
  const bucket = await resolveBucket(supabase, workspaceId, cleanString(body.bucket));
  const files = await listStorageFilesRecursive(supabase, bucket);
  let indexedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const assets: MediaAsset[] = [];

  for (const file of files) {
    try {
      const storagePath = cleanString(file.storage_path);
      if (!storagePath) {
        skippedCount += 1;
        continue;
      }
      const filename = filenameFromPath(storagePath);
      const mimeType = getFileMime(file);
      const mediaType = inferMediaType(storagePath, mimeType);
      const row = {
        workspace_id: workspaceId,
        asset_id: assetIdFromPath(bucket, storagePath),
        title: titleFromFilename(filename),
        filename,
        asset_name: filename,
        media_title: titleFromFilename(filename),
        bucket,
        storage_path: storagePath,
        mime_type: mimeType || null,
        media_type: mediaType,
        size_bytes: getFileSize(file),
        source: "supabase_storage",
        metadata: {
          storage_id: file.id || null,
          updated_at: file.updated_at || null,
          created_at: file.created_at || null,
          last_accessed_at: file.last_accessed_at || null,
        },
      };
      const { data, error } = await supabase
        .from("media_assets")
        .upsert(row, { onConflict: "workspace_id,bucket,storage_path" })
        .select("*")
        .single();
      if (error) throw error;
      indexedCount += 1;
      assets.push(data);
    } catch (err) {
      failedCount += 1;
      console.warn("[media-index] file index failed", cleanString(file.storage_path), err instanceof Error ? err.message : String(err));
    }
  }

  return {
    ok: true,
    bucket,
    indexedCount,
    skippedCount,
    failedCount,
    assets: await resolveUrlsForAssets(supabase, assets),
  };
}

async function listAssets(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string, body: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return {
    ok: true,
    assets: await resolveUrlsForAssets(supabase, data || []),
    bucket: await resolveBucket(supabase, workspaceId, cleanString(body.bucket)),
  };
}

function assetMatchQuery(body: Record<string, unknown>) {
  const id = cleanString(body.media_asset_id || body.id);
  const assetId = cleanString(body.asset_id || body.media_id);
  if (id) return { column: "id", value: id };
  if (assetId) return { column: "asset_id", value: assetId };
  throw new Error("Missing asset_id or media_asset_id");
}

async function updateAsset(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
  updates: Record<string, unknown>,
) {
  const match = assetMatchQuery(body);
  const { data, error } = await supabase
    .from("media_assets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq(match.column, match.value)
    .select("*")
    .single();
  if (error) throw error;
  return { ok: true, asset: (await resolveUrlsForAssets(supabase, [data]))[0] };
}

async function syncPostMediaFallback(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  postId: string,
  asset: MediaAsset,
  attach: boolean,
) {
  const mediaAssetId = cleanString(asset.id);
  const assetId = cleanString(asset.asset_id || asset.assetId || asset.id);
  try {
    if (attach && mediaAssetId) {
      await supabase.from("post_media").upsert({
        workspace_id: workspaceId,
        post_id: postId,
        media_asset_id: mediaAssetId,
      }, { onConflict: "workspace_id,post_id,media_asset_id" });
    } else if (mediaAssetId) {
      await supabase
        .from("post_media")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("post_id", postId)
        .eq("media_asset_id", mediaAssetId);
    }
  } catch (err) {
    console.warn("[media-index] post_media sync skipped", err instanceof Error ? err.message : String(err));
  }

  try {
    const { data: post } = await supabase
      .from("posts")
      .select("media_ids")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .maybeSingle();
    const current = Array.isArray(post?.media_ids) ? post.media_ids.map(String) : [];
    const next = attach
      ? Array.from(new Set(current.concat([assetId].filter(Boolean))))
      : current.filter((value) => value !== assetId);
    await supabase
      .from("posts")
      .update({ media_ids: next, media_id: attach ? assetId : null })
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId);
  } catch (err) {
    console.warn("[media-index] posts media_ids fallback skipped", err instanceof Error ? err.message : String(err));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await readBody(req);
    const action = cleanString(body.action || "list_assets");
    const workspaceId = cleanString(body.workspace_id);
    if (!workspaceId) return json({ ok: false, error: "Missing workspace_id" }, 400);

    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);

    if (action === "index_bucket") return json(await indexBucket(supabase, workspaceId, body));
    if (action === "list_assets") return json(await listAssets(supabase, workspaceId, body));
    if (action === "attach_to_post") {
      const postId = cleanString(body.post_id || body.postId);
      if (!postId) return json({ ok: false, error: "Missing post_id" }, 400);
      const result = await updateAsset(supabase, workspaceId, body, { linked_post_id: postId });
      await syncPostMediaFallback(supabase, workspaceId, postId, result.asset as MediaAsset, true);
      return json(result);
    }
    if (action === "detach_from_post") {
      const existingMatch = assetMatchQuery(body);
      const { data: existing } = await supabase
        .from("media_assets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq(existingMatch.column, existingMatch.value)
        .maybeSingle();
      const result = await updateAsset(supabase, workspaceId, body, { linked_post_id: null });
      const postId = cleanString(existing?.linked_post_id || body.post_id || body.postId);
      if (postId) await syncPostMediaFallback(supabase, workspaceId, postId, result.asset as MediaAsset, false);
      return json(result);
    }
    if (action === "update_asset") {
      const allowed: Record<string, unknown> = {};
      for (const key of ["title", "alt_text", "linked_post_id", "linked_note_id", "linked_inspo_id"]) {
        if (Object.prototype.hasOwnProperty.call(body, key)) allowed[key] = body[key] || null;
      }
      if (Array.isArray(body.tags)) allowed.tags = body.tags.map(String);
      if (body.metadata && typeof body.metadata === "object") allowed.metadata = body.metadata;
      return json(await updateAsset(supabase, workspaceId, body, allowed));
    }

    return json({ ok: false, error: "Unknown media-index action" }, 400);
  } catch (err) {
    console.error("[media-index] error", err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: err instanceof Error ? err.message : "Media index failed" }, 400);
  }
});
