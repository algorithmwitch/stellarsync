import { corsHeaders, getAuthUser, getSupabaseServiceClient, json, readBody, requireWorkspaceMember } from "../_shared/social.ts";

type MediaAsset = Record<string, unknown>;
type BucketResolution = {
  bucket: string;
  configuredBucket: string;
  bucketExists: boolean;
  bucketFallbackUsed: boolean;
  warnings: string[];
};
type PrefixResolution = {
  prefix: string;
  workspaceSlug: string;
};
type StorageListDiagnostics = {
  rootCount: number;
  folderCount: number;
  fileCount: number;
  listErrors: string[];
};

const DEFAULT_BUCKET = "media";
const CONFIGURED_BUCKET = Deno.env.get("SUPABASE_MEDIA_BUCKET") || Deno.env.get("MEDIA_BUCKET") || DEFAULT_BUCKET;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg"]);
const MEDIA_ASSET_COLUMNS = new Set([
  "workspace_id",
  "uploaded_by",
  "post_id",
  "filename",
  "storage_path",
  "media_url",
  "media_type",
  "alt_text",
  "asset_id",
  "title",
  "bucket",
  "thumbnail_url",
  "mime_type",
  "size_bytes",
  "width",
  "height",
  "duration_seconds",
  "source",
  "linked_post_id",
  "linked_note_id",
  "linked_inspo_id",
  "tags",
  "metadata",
]);

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return cleanString((error as Record<string, unknown>).message);
  return String(error || "Media index failed");
}

function enrichError(error: unknown, context: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(errorMessage(error));
  Object.assign(err, context);
  if (error && typeof error === "object") {
    (err as Error & { supabaseError?: unknown }).supabaseError = error;
  }
  return err;
}

function serializeError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) {
    const enriched = error as Error & { supabaseError?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      supabaseError: enriched.supabaseError || null,
    };
  }
  return error;
}

function supabaseErrorDetails(error: unknown) {
  const source = error instanceof Error && (error as Error & { supabaseError?: unknown }).supabaseError
    ? (error as Error & { supabaseError?: unknown }).supabaseError
    : error;
  const record = source && typeof source === "object" ? source as Record<string, unknown> : {};
  return {
    message: cleanString(record.message) || errorMessage(error),
    details: record.details || null,
    hint: record.hint || null,
    code: record.code || null,
  };
}

function isMissingMediaAssetStoragePathUniqueIndex(error: unknown) {
  const detail = supabaseErrorDetails(error);
  const text = [
    detail.message,
    cleanString(detail.details),
    cleanString(detail.hint),
    cleanString(detail.code),
  ].join(" ").toLowerCase();
  return text.includes("42p10") ||
    text.includes("no unique or exclusion constraint") ||
    text.includes("on conflict") && text.includes("constraint");
}

function formatUpsertError(storagePath: string, payload: Record<string, unknown>, error: unknown) {
  const detail = supabaseErrorDetails(error);
  return {
    storage_path: storagePath,
    payloadKeys: Object.keys(payload),
    errorMessage: isMissingMediaAssetStoragePathUniqueIndex(error)
      ? "Missing unique index on media_assets(workspace_id,bucket,storage_path)"
      : detail.message,
    errorDetails: detail.details,
    errorHint: detail.hint,
    errorCode: detail.code,
  };
}

function onlyKnownMediaAssetColumns(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!MEDIA_ASSET_COLUMNS.has(key)) continue;
    if (value === undefined) continue;
    normalized[key] = value;
  }
  return normalized;
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

async function getWorkspaceRecord(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string) {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw enrichError(error, { stage: "workspace lookup", workspace_id: workspaceId });
  return (workspace || {}) as Record<string, unknown>;
}

async function getMediaConnectionBucket(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string) {
  const { data: connections, error } = await supabase
    .from("workspace_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("provider", ["media", "supabase_storage", "storage"])
    .limit(1);
  if (error) throw enrichError(error, { stage: "bucket lookup: workspace_connections", workspace_id: workspaceId });
  const connection = Array.isArray(connections) ? connections[0] : null;
  const config = (connection?.config || {}) as Record<string, unknown>;
  const metadata = (connection?.metadata || {}) as Record<string, unknown>;
  return cleanString(config.bucket || config.media_bucket || metadata.bucket || metadata.media_bucket);
}

async function getExistingBucketNames(supabase: ReturnType<typeof getSupabaseServiceClient>) {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw enrichError(error, { stage: "bucket lookup: listBuckets" });
  return new Set((data || []).map((bucket) => cleanString(bucket.name)).filter(Boolean));
}

function firstConfiguredBucket(...values: unknown[]) {
  for (const value of values) {
    const bucket = cleanString(value);
    if (bucket) return bucket;
  }
  return CONFIGURED_BUCKET || DEFAULT_BUCKET;
}

async function resolveBucket(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  workspace: Record<string, unknown>,
  requestedBucket = "",
): Promise<BucketResolution> {
  const existingBuckets = await getExistingBucketNames(supabase);
  const workspaceBucket = cleanString(workspace.media_bucket || workspace.storage_bucket || workspace.bucket);
  const connectionBucket = await getMediaConnectionBucket(supabase, workspaceId);
  const payloadBucket = cleanString(requestedBucket);
  const configuredBucket = firstConfiguredBucket(payloadBucket, workspaceBucket, connectionBucket, CONFIGURED_BUCKET);
  const warnings: string[] = [];

  if (existingBuckets.has(configuredBucket) && configuredBucket === DEFAULT_BUCKET) {
    return { bucket: configuredBucket, configuredBucket, bucketExists: true, bucketFallbackUsed: false, warnings };
  }

  if (existingBuckets.has(DEFAULT_BUCKET)) {
    if (configuredBucket !== DEFAULT_BUCKET) {
      warnings.push(`[media-index] configured bucket ${configuredBucket} differs from media, using ${DEFAULT_BUCKET}`);
      console.warn(`[media-index] configured bucket differs from media, using ${DEFAULT_BUCKET}`, configuredBucket);
    }
    return {
      bucket: DEFAULT_BUCKET,
      configuredBucket,
      bucketExists: true,
      bucketFallbackUsed: configuredBucket !== DEFAULT_BUCKET,
      warnings,
    };
  }

  if (existingBuckets.has(configuredBucket)) {
    warnings.push(`[media-index] media bucket not found, using configured bucket ${configuredBucket}`);
    return { bucket: configuredBucket, configuredBucket, bucketExists: true, bucketFallbackUsed: false, warnings };
  }
  warnings.push(`[media-index] no configured media bucket exists; attempted ${configuredBucket}, fallback ${DEFAULT_BUCKET}`);
  return {
    bucket: DEFAULT_BUCKET,
    configuredBucket,
    bucketExists: false,
    bucketFallbackUsed: configuredBucket !== DEFAULT_BUCKET,
    warnings,
  };
}

function slugFromWorkspace(workspace: Record<string, unknown>, body: Record<string, unknown>) {
  return cleanString(
    body.workspace_slug ||
    body.workspaceSlug ||
    workspace.slug ||
    workspace.workspace_slug ||
    workspace.workspaceSlug ||
    workspace.name
  ).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function resolvePrefix(workspace: Record<string, unknown>, body: Record<string, unknown>): PrefixResolution {
  const explicitPrefix = cleanString(body.prefix);
  if (explicitPrefix) return { prefix: explicitPrefix.replace(/^\/+/, "").replace(/\/?$/, "/"), workspaceSlug: slugFromWorkspace(workspace, body) };
  if (body.include_all === true) return { prefix: "", workspaceSlug: slugFromWorkspace(workspace, body) };
  const workspaceSlug = slugFromWorkspace(workspace, body);
  if (!workspaceSlug || ["gpe", "girl-plus-environment", "girlplusenvironment"].includes(workspaceSlug)) {
    return { prefix: "gpe/", workspaceSlug: workspaceSlug || "gpe" };
  }
  return { prefix: workspaceSlug ? `${workspaceSlug}/` : "", workspaceSlug };
}

function isFolderItem(item: Record<string, unknown>) {
  const metadata = item.metadata as unknown;
  return !item.id && (!metadata || Object.keys((metadata || {}) as Record<string, unknown>).length === 0);
}

function isFolderPlaceholder(path: string, file: Record<string, unknown>) {
  if (!path || path.endsWith("/")) return true;
  const size = getFileSize(file);
  return !file.id && size === null && !extensionFromPath(path);
}

async function listStorageFilesRecursive(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  bucket: string,
  prefix = "",
  diagnostics: StorageListDiagnostics = { rootCount: 0, folderCount: 0, fileCount: 0, listErrors: [] },
): Promise<Array<Record<string, unknown> & { storage_path: string }>> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) {
    diagnostics.listErrors.push(`${prefix || "/"}: ${error.message || String(error)}`);
    throw enrichError(error, { stage: "storage listing", bucket, prefix });
  }
  if (diagnostics.rootCount === 0 && diagnostics.folderCount === 0 && diagnostics.fileCount === 0) {
    diagnostics.rootCount = data?.length || 0;
  }

  const files: Array<Record<string, unknown> & { storage_path: string }> = [];
  for (const item of data || []) {
    const name = cleanString(item.name);
    if (!name) continue;
    const path = prefix ? `${prefix.replace(/\/+$/, "")}/${name}` : name;
    if (isFolderItem(item as Record<string, unknown>)) {
      diagnostics.folderCount += 1;
      try {
        files.push(...await listStorageFilesRecursive(supabase, bucket, path, diagnostics));
      } catch (err) {
        throw enrichError(err, { stage: "storage recursion", bucket, prefix: path });
      }
    } else if (!isFolderPlaceholder(path, item as Record<string, unknown>)) {
      diagnostics.fileCount += 1;
      files.push({ ...(item as Record<string, unknown>), storage_path: path });
    } else {
      diagnostics.folderCount += 1;
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

async function buildMediaAssetUpsertPayload(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  uploadedBy: string,
  bucket: string,
  file: Record<string, unknown> & { storage_path: string },
) {
  const storagePath = cleanString(file.storage_path);
  const filename = filenameFromPath(storagePath);
  const mimeType = getFileMime(file);
  const mediaType = inferMediaType(storagePath, mimeType);
  const mediaUrl = storagePath ? await resolveAssetUrl(supabase, bucket, storagePath) : "";
  return onlyKnownMediaAssetColumns({
    workspace_id: workspaceId,
    uploaded_by: uploadedBy || null,
    post_id: null,
    filename,
    storage_path: storagePath,
    media_url: mediaUrl || null,
    media_type: mediaType,
    alt_text: null,
    asset_id: assetIdFromPath(bucket, storagePath),
    title: titleFromFilename(filename),
    bucket,
    thumbnail_url: mediaType === "image" ? (mediaUrl || null) : null,
    mime_type: mimeType || null,
    size_bytes: getFileSize(file),
    width: null,
    height: null,
    duration_seconds: null,
    source: "supabase_storage",
    linked_post_id: null,
    linked_note_id: null,
    linked_inspo_id: null,
    tags: [],
    metadata: {
      storage_id: file.id || null,
      updated_at: file.updated_at || null,
      created_at: file.created_at || null,
      last_accessed_at: file.last_accessed_at || null,
    },
  });
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

function baseDiagnostics(action: string, workspaceId: string, workspaceSlug: string, bucketResolution: BucketResolution, prefix = "") {
  return {
    ok: false,
    action,
    workspace_id: workspaceId,
    workspace_slug: workspaceSlug,
    bucket: bucketResolution.bucket,
    configuredBucket: bucketResolution.configuredBucket,
    bucketExists: bucketResolution.bucketExists,
    bucketFallbackUsed: bucketResolution.bucketFallbackUsed,
    prefix,
    include_all: false,
    rootCount: 0,
    folderCount: 0,
    fileCount: 0,
    indexedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    samplePaths: [] as string[],
    listErrors: [] as string[],
    upsertErrors: [] as Array<Record<string, unknown>>,
    assetsReturnedCount: 0,
    message: "",
  };
}

async function indexBucket(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string, body: Record<string, unknown>, uploadedBy = "") {
  const workspace = await getWorkspaceRecord(supabase, workspaceId);
  const bucketResolution = await resolveBucket(supabase, workspaceId, workspace, cleanString(body.bucket));
  const { prefix, workspaceSlug } = resolvePrefix(workspace, body);
  const includeAll = body.include_all === true;
  const response = baseDiagnostics("index_bucket", workspaceId, workspaceSlug, bucketResolution, prefix);
  response.include_all = includeAll;
  const diagnostics: StorageListDiagnostics = { rootCount: 0, folderCount: 0, fileCount: 0, listErrors: [] };
  const files = bucketResolution.bucketExists ? await listStorageFilesRecursive(supabase, bucketResolution.bucket, prefix, diagnostics) : [];
  let indexedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const assets: MediaAsset[] = [];
  const upsertErrors: Array<Record<string, unknown>> = [];
  const samplePaths = files.slice(0, 10).map((file) => cleanString(file.storage_path)).filter(Boolean);

  console.log("[media-index] bucket", bucketResolution.bucket);
  console.log("[media-index] prefix", prefix);
  console.log("[media-index] fileCount", diagnostics.fileCount);

  Object.assign(response, {
    rootCount: diagnostics.rootCount,
    folderCount: diagnostics.folderCount,
    fileCount: diagnostics.fileCount,
    samplePaths,
    listErrors: diagnostics.listErrors,
  });

  if (!bucketResolution.bucketExists) {
    response.message = `Bucket ${bucketResolution.bucket} does not exist. Configured bucket was ${bucketResolution.configuredBucket}.`;
    return response;
  }

  if (diagnostics.fileCount === 0 && !includeAll) {
    const allDiagnostics: StorageListDiagnostics = { rootCount: 0, folderCount: 0, fileCount: 0, listErrors: [] };
    const allFiles = await listStorageFilesRecursive(supabase, bucketResolution.bucket, "", allDiagnostics);
    const allBucketFileCount = allDiagnostics.fileCount;
    const allBucketSamplePaths = allFiles.slice(0, 10).map((file) => cleanString(file.storage_path)).filter(Boolean);
    const message = allBucketFileCount > 0
      ? `No files found in ${bucketResolution.bucket}/${prefix}. Files exist elsewhere in bucket ${bucketResolution.bucket}. Move them into ${bucketResolution.bucket}/${prefix} or index all.`
      : `No files found in bucket ${bucketResolution.bucket} under prefix ${prefix}. No files were found elsewhere in the bucket.`;
    console.log("[media-index] indexedCount", 0);
    return {
      ...response,
      allBucketFileCount,
      allBucketSamplePaths,
      message,
      assets,
    };
  }

  const upsertPayloads: Array<Record<string, unknown>> = [];
  const payloadsByPath = new Map<string, Record<string, unknown>>();
  for (const file of files) {
    try {
      const storagePath = cleanString(file.storage_path);
      if (!storagePath) {
        skippedCount += 1;
        continue;
      }
      const payload = await buildMediaAssetUpsertPayload(supabase, workspaceId, uploadedBy, bucketResolution.bucket, file);
      upsertPayloads.push(payload);
      payloadsByPath.set(storagePath, payload);
    } catch (err) {
      failedCount += 1;
      console.warn("[media-index] file index failed", cleanString(file.storage_path), err instanceof Error ? err.message : String(err));
      const storagePath = cleanString(file.storage_path);
      upsertErrors.push(formatUpsertError(storagePath, payloadsByPath.get(storagePath) || {}, err));
    }
  }

  if (upsertPayloads.length) {
    const batchResult = await supabase
      .from("media_assets")
      .upsert(upsertPayloads, { onConflict: "workspace_id,bucket,storage_path" })
      .select("*");

    if (!batchResult.error && Array.isArray(batchResult.data)) {
      indexedCount = batchResult.data.length;
      failedCount += Math.max(0, upsertPayloads.length - indexedCount);
      assets.push(...batchResult.data);
    } else {
      const batchMessage = isMissingMediaAssetStoragePathUniqueIndex(batchResult.error)
        ? "Missing unique index on media_assets(workspace_id,bucket,storage_path)"
        : errorMessage(batchResult.error);
      console.warn("[media-index] batch upsert failed", batchMessage);
      if (upsertErrors.length < 10) {
        upsertErrors.push(formatUpsertError(
          "__batch__",
          upsertPayloads[0] || {},
          batchResult.error || new Error(batchMessage),
        ));
      }

      indexedCount = 0;
      for (const payload of upsertPayloads) {
        const storagePath = cleanString(payload.storage_path);
        const { data, error } = await supabase
          .from("media_assets")
          .upsert(payload, { onConflict: "workspace_id,bucket,storage_path" })
          .select("*")
          .single();
        if (error) {
          failedCount += 1;
          if (upsertErrors.length < 10) {
            upsertErrors.push(formatUpsertError(storagePath, payload, error));
          }
          console.warn("[media-index] one-by-one upsert failed", storagePath, supabaseErrorDetails(error));
          continue;
        }
        indexedCount += 1;
        assets.push(data);
      }
    }
  }

  console.log("[media-index] indexedCount", indexedCount);
  const firstUpsertErrorMessage = cleanString(upsertErrors[0]?.errorMessage);
  const allFailedMessage = firstUpsertErrorMessage === "Missing unique index on media_assets(workspace_id,bucket,storage_path)"
    ? firstUpsertErrorMessage
    : `Indexed 0 file(s), ${failedCount || upsertPayloads.length} failed. See upsertErrors.`;

  return {
    ...response,
    ok: indexedCount > 0,
    rootCount: diagnostics.rootCount,
    folderCount: diagnostics.folderCount,
    fileCount: diagnostics.fileCount,
    indexedCount,
    skippedCount,
    failedCount,
    samplePaths,
    listErrors: diagnostics.listErrors,
    upsertErrors: upsertErrors.slice(0, 10),
    assetsReturnedCount: assets.length,
    message: indexedCount > 0
      ? (failedCount ? `Indexed ${indexedCount} file(s), ${failedCount} failed. See upsertErrors.` : `Indexed ${indexedCount} file(s) from ${bucketResolution.bucket}/${prefix}.`)
      : allFailedMessage,
    assets: await resolveUrlsForAssets(supabase, assets),
  };
}

async function listAssets(supabase: ReturnType<typeof getSupabaseServiceClient>, workspaceId: string, body: Record<string, unknown>) {
  const workspace = await getWorkspaceRecord(supabase, workspaceId);
  const bucketResolution = await resolveBucket(supabase, workspaceId, workspace, cleanString(body.bucket));
  const workspaceSlug = slugFromWorkspace(workspace, body);
  const { data, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw enrichError(error, { stage: "media_assets query", workspace_id: workspaceId });
  const assets = data || [];
  let postMediaRows: Record<string, unknown>[] = [];
  try {
    const { data: postMediaData, error: postMediaError } = await supabase
      .from("post_media")
      .select("id,workspace_id,post_id,media_asset_id,sort_order,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true });
    if (postMediaError) throw enrichError(postMediaError, { stage: "post_media query", workspace_id: workspaceId });
    postMediaRows = postMediaData || [];
  } catch (err) {
    console.warn("[media-index] post_media list skipped", err instanceof Error ? err.message : String(err));
  }
  const bucketCounts = assets.reduce((counts: Record<string, number>, asset: Record<string, unknown>) => {
    const bucket = cleanString(asset.bucket) || "(none)";
    counts[bucket] = (counts[bucket] || 0) + 1;
    return counts;
  }, {});
  return {
    ok: true,
    action: "list_assets",
    workspace_id: workspaceId,
    workspace_slug: workspaceSlug,
    count: assets.length,
    bucketCounts,
    sampleAssets: assets.slice(0, 10).map((asset: Record<string, unknown>) => ({
      id: asset.id,
      asset_id: asset.asset_id,
      bucket: asset.bucket,
      storage_path: asset.storage_path,
      media_url: asset.media_url,
    })),
    assetsReturnedCount: assets.length,
    assets: await resolveUrlsForAssets(supabase, assets),
    post_media: postMediaRows,
    postMedia: postMediaRows,
    ...bucketResolution,
  };
}

function assetMatchQuery(body: Record<string, unknown>) {
  const id = cleanString(body.media_asset_id || body.id);
  const assetId = cleanString(body.asset_id || body.media_id);
  if (id) return { column: "id", value: id };
  if (assetId) return { column: "asset_id", value: assetId };
  const storagePath = cleanString(body.storage_path || body.storagePath);
  if (storagePath) return { column: "storage_path", value: storagePath };
  throw new Error("Missing asset_id or media_asset_id");
}

async function createAsset(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
  uploadedBy = "",
) {
  const workspace = await getWorkspaceRecord(supabase, workspaceId);
  const bucketResolution = await resolveBucket(supabase, workspaceId, workspace, cleanString(body.bucket || DEFAULT_BUCKET));
  if (!bucketResolution.bucketExists) {
    return {
      ok: false,
      action: "create_asset",
      workspace_id: workspaceId,
      bucket: bucketResolution.bucket,
      configuredBucket: bucketResolution.configuredBucket,
      bucketExists: false,
      bucketFallbackUsed: bucketResolution.bucketFallbackUsed,
      error: `Bucket ${bucketResolution.bucket} does not exist.`,
    };
  }

  const storagePath = cleanString(body.storage_path || body.storagePath);
  if (!storagePath) return { ok: false, action: "create_asset", workspace_id: workspaceId, error: "Missing storage_path" };

  const filename = cleanString(body.filename) || filenameFromPath(storagePath);
  const mimeType = cleanString(body.mime_type || body.mimeType);
  const mediaType = cleanString(body.media_type || body.mediaType) || inferMediaType(storagePath, mimeType);
  const mediaUrl = cleanString(body.media_url || body.mediaUrl || body.url) || await resolveAssetUrl(supabase, bucketResolution.bucket, storagePath);
  const linkedPostId = cleanString(body.linked_post_id || body.linkedPostId || body.post_id || body.postId);
  const tags = Array.isArray(body.tags)
    ? body.tags.map(String).filter(Boolean)
    : cleanString(body.tags).split(",").map((tag) => tag.trim()).filter(Boolean);
  const incomingMetadata = body.metadata && typeof body.metadata === "object" ? body.metadata as Record<string, unknown> : {};

  const payload = onlyKnownMediaAssetColumns({
    workspace_id: workspaceId,
    uploaded_by: uploadedBy || null,
    post_id: linkedPostId || null,
    filename,
    storage_path: storagePath,
    media_url: mediaUrl || null,
    media_type: mediaType,
    alt_text: cleanString(body.alt_text || body.altText) || null,
    asset_id: cleanString(body.asset_id || body.assetId) || assetIdFromPath(bucketResolution.bucket, storagePath),
    title: cleanString(body.title) || titleFromFilename(filename),
    bucket: bucketResolution.bucket,
    thumbnail_url: cleanString(body.thumbnail_url || body.thumbnailUrl) || (mediaType === "image" ? mediaUrl || null : null),
    mime_type: mimeType || null,
    size_bytes: Number(body.size_bytes || body.sizeBytes || 0) || null,
    width: Number(body.width || 0) || null,
    height: Number(body.height || 0) || null,
    duration_seconds: Number(body.duration_seconds || body.durationSeconds || 0) || null,
    source: "supabase_storage",
    linked_post_id: linkedPostId || null,
    linked_note_id: cleanString(body.linked_note_id || body.linkedNoteId) || null,
    linked_inspo_id: cleanString(body.linked_inspo_id || body.linkedInspoId) || null,
    tags,
    metadata: {
      ...incomingMetadata,
      created_by_action: "create_asset",
    },
  });

  const { data, error } = await supabase
    .from("media_assets")
    .upsert(payload, { onConflict: "workspace_id,bucket,storage_path" })
    .select("*")
    .single();
  if (error) {
    return {
      ok: false,
      action: "create_asset",
      workspace_id: workspaceId,
      bucket: bucketResolution.bucket,
      storage_path: storagePath,
      upsertErrors: [formatUpsertError(storagePath, payload, error)],
      error: isMissingMediaAssetStoragePathUniqueIndex(error)
        ? "Missing unique index on media_assets(workspace_id,bucket,storage_path)"
        : errorMessage(error),
    };
  }

  const asset = (await resolveUrlsForAssets(supabase, [data]))[0];
  if (!asset) {
    return {
      ok: false,
      action: "create_asset",
      workspace_id: workspaceId,
      bucket: bucketResolution.bucket,
      storage_path: storagePath,
      error: "media_assets row was upserted but could not be returned.",
    };
  }
  if (linkedPostId) {
    try {
      await syncPostMediaFallback(supabase, workspaceId, linkedPostId, asset, true);
    } catch (err) {
      console.warn("[media-index] create_asset post attach skipped", err instanceof Error ? err.message : String(err));
    }
  }

  return {
    ok: true,
    action: "create_asset",
    workspace_id: workspaceId,
    bucket: bucketResolution.bucket,
    storage_path: storagePath,
    asset,
  };
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
  if (error) throw enrichError(error, { stage: "media_assets query/update", workspace_id: workspaceId, match });
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
      const { error } = await supabase.from("post_media").upsert({
        workspace_id: workspaceId,
        post_id: postId,
        media_asset_id: mediaAssetId,
      }, { onConflict: "workspace_id,post_id,media_asset_id" });
      if (error) throw enrichError(error, { stage: "post_media upsert", workspace_id: workspaceId, post_id: postId, media_asset_id: mediaAssetId });
    } else if (mediaAssetId) {
      const { error } = await supabase
        .from("post_media")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("post_id", postId)
        .eq("media_asset_id", mediaAssetId);
      if (error) throw enrichError(error, { stage: "post_media delete", workspace_id: workspaceId, post_id: postId, media_asset_id: mediaAssetId });
    }
  } catch (err) {
    console.warn("[media-index] post_media sync skipped", err instanceof Error ? err.message : String(err));
    throw err;
  }

  try {
    const { data: post, error: selectError } = await supabase
      .from("posts")
      .select("media_ids")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .maybeSingle();
    if (selectError) throw enrichError(selectError, { stage: "posts media_ids select", workspace_id: workspaceId, post_id: postId });
    const current = Array.isArray(post?.media_ids) ? post.media_ids.map(String) : [];
    const next = attach
      ? Array.from(new Set(current.concat([assetId].filter(Boolean))))
      : current.filter((value) => value !== assetId);
    const { error: updateError } = await supabase
      .from("posts")
      .update({ media_ids: next, media_id: attach ? assetId : null })
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId);
    if (updateError) throw enrichError(updateError, { stage: "posts media_ids update", workspace_id: workspaceId, post_id: postId });
  } catch (err) {
    console.warn("[media-index] posts media_ids fallback skipped", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

function isMissingColumnError(error: unknown) {
  const detail = supabaseErrorDetails(error);
  const text = [detail.message, cleanString(detail.details), cleanString(detail.hint), cleanString(detail.code)].join(" ").toLowerCase();
  return text.includes("42703") || text.includes("pgrst204") || text.includes("column") && text.includes("does not exist");
}

async function resolveMediaAssetForAttach(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
  uploadedBy = "",
) {
  const id = cleanString(body.media_asset_id || body.id);
  const assetId = cleanString(body.asset_id || body.media_id);
  const storagePath = cleanString(body.storage_path || body.storagePath);
  const bucket = cleanString(body.bucket) || DEFAULT_BUCKET;
  let query = supabase.from("media_assets").select("*").eq("workspace_id", workspaceId);

  if (id) {
    query = query.eq("id", id);
  } else if (assetId) {
    query = query.eq("asset_id", assetId);
  } else if (storagePath) {
    query = query.eq("bucket", bucket).eq("storage_path", storagePath);
  } else {
    throw new Error("Missing media_asset_id, asset_id, or storage_path");
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw enrichError(error, { stage: "media_assets resolve for attach", workspace_id: workspaceId, id, assetId, storagePath });
  if (data) {
    console.log("[media-match] resolved asset", { id: data.id, asset_id: data.asset_id, storage_path: data.storage_path });
    return data as MediaAsset;
  }

  if (!storagePath) throw new Error("Media asset not found and no storage_path was provided to create it.");
  const created = await createAsset(supabase, workspaceId, body, uploadedBy);
  const createdRecord = created as Record<string, unknown>;
  if (!createdRecord.ok || !createdRecord.asset) {
    throw enrichError(new Error(cleanString(createdRecord.error) || "Could not create media asset before attach."), {
      stage: "media_assets create before attach",
      workspace_id: workspaceId,
      storage_path: storagePath,
      createAsset: created,
    });
  }
  console.log("[media-match] resolved asset", {
    id: (createdRecord.asset as MediaAsset).id,
    asset_id: (createdRecord.asset as MediaAsset).asset_id,
    storage_path: (createdRecord.asset as MediaAsset).storage_path,
  });
  return createdRecord.asset as MediaAsset;
}

function mediaAssetIdPayloadsFromBody(body: Record<string, unknown>) {
  const mediaAssets = Array.isArray(body.media_assets) ? body.media_assets : Array.isArray(body.mediaAssets) ? body.mediaAssets : [];
  if (mediaAssets.length) {
    return mediaAssets
      .filter((item) => item && typeof item === "object")
      .map((item) => item as Record<string, unknown>);
  }
  const ids = Array.isArray(body.media_asset_ids) ? body.media_asset_ids : Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds : [];
  if (ids.length) return ids.map((id) => ({ media_asset_id: cleanString(id) }));
  return [body];
}

async function getOrderedAttachedMedia(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  postId: string,
) {
  let postMediaRows: Record<string, unknown>[] = [];
  try {
    const { data, error } = await supabase
      .from("post_media")
      .select("id,workspace_id,post_id,media_asset_id,sort_order,created_at,updated_at")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .order("sort_order", { ascending: true });
    if (error) throw enrichError(error, { stage: "post_media ordered query", workspace_id: workspaceId, post_id: postId });
    postMediaRows = data || [];
  } catch (err) {
    console.warn("[media-index] post_media ordered query skipped", err instanceof Error ? err.message : String(err));
  }

  if (postMediaRows.length) {
    const mediaAssetIds = postMediaRows.map((row) => cleanString(row.media_asset_id)).filter(Boolean);
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("id", mediaAssetIds);
    if (error) throw enrichError(error, { stage: "media_assets ordered query", workspace_id: workspaceId, post_id: postId });
    const byId = new Map((data || []).map((asset: MediaAsset) => [cleanString(asset.id), asset]));
    const ordered = postMediaRows.map((row) => byId.get(cleanString(row.media_asset_id))).filter(Boolean) as MediaAsset[];
    const resolved = await resolveUrlsForAssets(supabase, ordered);
    return {
      post_media: postMediaRows,
      attached_media: resolved,
      ordered_media_asset_ids: resolved.map((asset) => cleanString(asset.id)).filter(Boolean),
      ordered_asset_ids: resolved.map((asset) => cleanString(asset.asset_id || asset.assetId || asset.id)).filter(Boolean),
    };
  }

  let postMediaIds: string[] = [];
  try {
    const { data: post, error } = await supabase
      .from("posts")
      .select("media_ids")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .maybeSingle();
    if (error) throw error;
    postMediaIds = Array.isArray(post?.media_ids) ? post.media_ids.map(String).filter(Boolean) : [];
  } catch (err) {
    console.warn("[media-index] posts media_ids ordered fallback skipped", supabaseErrorDetails(err));
  }
  if (postMediaIds.length) {
    const { data, error } = await supabase
      .from("media_assets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .in("asset_id", postMediaIds);
    if (error) throw enrichError(error, { stage: "media_assets media_ids fallback query", workspace_id: workspaceId, post_id: postId });
    const byAssetId = new Map((data || []).map((asset: MediaAsset) => [cleanString(asset.asset_id || asset.id), asset]));
    const ordered = postMediaIds.map((id) => byAssetId.get(id)).filter(Boolean) as MediaAsset[];
    const resolved = await resolveUrlsForAssets(supabase, ordered);
    return {
      post_media: [],
      attached_media: resolved,
      ordered_media_asset_ids: resolved.map((asset) => cleanString(asset.id)).filter(Boolean),
      ordered_asset_ids: resolved.map((asset) => cleanString(asset.asset_id || asset.assetId || asset.id)).filter(Boolean),
    };
  }

  const { data: linkedData, error: linkedError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .or(`linked_post_id.eq.${postId},post_id.eq.${postId}`)
    .order("created_at", { ascending: true });
  if (linkedError) throw enrichError(linkedError, { stage: "media_assets linked fallback query", workspace_id: workspaceId, post_id: postId });
  const resolved = await resolveUrlsForAssets(supabase, linkedData || []);
  return {
    post_media: [],
    attached_media: resolved,
    ordered_media_asset_ids: resolved.map((asset) => cleanString(asset.id)).filter(Boolean),
    ordered_asset_ids: resolved.map((asset) => cleanString(asset.asset_id || asset.assetId || asset.id)).filter(Boolean),
  };
}

async function updatePostMediaIdsForOrder(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  postId: string,
  attachedMedia: MediaAsset[],
) {
  const orderedAssetIds = attachedMedia.map((asset) => cleanString(asset.asset_id || asset.assetId || asset.id)).filter(Boolean);
  const mediaId = orderedAssetIds[0] || null;
  const format = orderedAssetIds.length >= 2 ? "carousel" : orderedAssetIds.length === 1 ? cleanString(attachedMedia[0]?.media_type || attachedMedia[0]?.mediaType || "image") || "image" : "text";
  try {
    const { error } = await supabase
      .from("posts")
      .update({
        media_ids: orderedAssetIds,
        media_id: mediaId,
        post_type: format,
        format,
      })
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId);
    if (error) throw error;
  } catch (err) {
    if (isMissingColumnError(err)) {
      console.warn("[media-index] posts ordered media update skipped; column missing", supabaseErrorDetails(err));
    } else {
      console.warn("[media-index] posts ordered media update skipped", supabaseErrorDetails(err));
    }
  }
}

async function orderedAttachedMediaResponse(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  postId: string,
  extras: Record<string, unknown> = {},
) {
  const ordered = await getOrderedAttachedMedia(supabase, workspaceId, postId);
  await updatePostMediaIdsForOrder(supabase, workspaceId, postId, ordered.attached_media);
  return {
    ok: true,
    post_id: postId,
    ...extras,
    ...ordered,
  };
}

async function removeMediaIdsFromPost(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  postId: string,
  idsToRemove: string[],
) {
  const removeSet = new Set(idsToRemove.map(String).filter(Boolean));
  if (!removeSet.size) return;
  try {
    const { data: post, error: selectError } = await supabase
      .from("posts")
      .select("media_ids")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .maybeSingle();
    if (selectError) throw selectError;
    const current = Array.isArray(post?.media_ids) ? post.media_ids.map(String).filter(Boolean) : [];
    const next = current.filter((id) => !removeSet.has(id));
    const { error: updateError } = await supabase
      .from("posts")
      .update({ media_ids: next, media_id: next[0] || null })
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId);
    if (updateError) throw updateError;
  } catch (err) {
    if (isMissingColumnError(err)) {
      console.warn("[media-index] posts media_ids detach skipped; column missing", supabaseErrorDetails(err));
    } else {
      console.warn("[media-index] posts media_ids detach skipped", supabaseErrorDetails(err));
    }
  }
}

async function attachAssetToPost(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
  uploadedBy = "",
) {
  const postId = cleanString(body.post_id || body.postId);
  if (!postId) return { ok: false, error: "Missing post_id" };
  console.log("[media-match] attach request", {
    workspace_id: workspaceId,
    post_id: postId,
    media_asset_id: cleanString(body.media_asset_id || body.id),
    asset_id: cleanString(body.asset_id || body.media_id),
    storage_path: cleanString(body.storage_path || body.storagePath),
  });

  const payloads = mediaAssetIdPayloadsFromBody(body);
  let maxSortOrder = -1;
  try {
    const { data: existingRows, error: existingRowsError } = await supabase
      .from("post_media")
      .select("sort_order")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId);
    if (existingRowsError) throw existingRowsError;
    maxSortOrder = (existingRows || []).reduce((max: number, row: Record<string, unknown>) => Math.max(max, Number(row.sort_order || 0) || 0), -1);
  } catch (err) {
    console.warn("[media-match] existing post_media sort lookup skipped", supabaseErrorDetails(err));
  }
  const incomingSortOrder = Number(body.sort_order ?? body.sortOrder);
  const startSortOrder = Number.isFinite(incomingSortOrder) ? incomingSortOrder : maxSortOrder + 1;
  let lastUpdatedAsset: MediaAsset | null = null;
  let lastPostMediaRow: Record<string, unknown> | null = null;

  for (let index = 0; index < payloads.length; index += 1) {
    const assetBody = { ...body, ...payloads[index] };
    const resolved = await resolveMediaAssetForAttach(supabase, workspaceId, assetBody, uploadedBy);
    const mediaAssetId = cleanString(resolved.id);
    if (!mediaAssetId) throw new Error("Resolved media asset has no id.");
    const sortOrder = Number(payloads[index].sort_order ?? payloads[index].sortOrder);
    const nextSortOrder = Number.isFinite(sortOrder) ? sortOrder : startSortOrder + index;

    const { data: postMediaRow, error: postMediaError } = await supabase
      .from("post_media")
      .upsert({
        workspace_id: workspaceId,
        post_id: postId,
        media_asset_id: mediaAssetId,
        sort_order: nextSortOrder,
      }, { onConflict: "workspace_id,post_id,media_asset_id" })
      .select("*")
      .single();
    console.log("[media-match] post_media response", { data: postMediaRow, error: postMediaError });
    if (postMediaError) throw enrichError(postMediaError, { stage: "post_media upsert", workspace_id: workspaceId, post_id: postId, media_asset_id: mediaAssetId });

    const { data: updatedAsset, error: updateAssetError } = await supabase
      .from("media_assets")
      .update({ linked_post_id: postId, post_id: postId, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", mediaAssetId)
      .select("*")
      .single();
    if (updateAssetError) throw enrichError(updateAssetError, { stage: "media_assets linked_post_id update", workspace_id: workspaceId, media_asset_id: mediaAssetId });
    lastUpdatedAsset = updatedAsset;
    lastPostMediaRow = postMediaRow;
  }

  const response = await orderedAttachedMediaResponse(supabase, workspaceId, postId, {
    action: "attach_to_post",
    asset: lastUpdatedAsset ? (await resolveUrlsForAssets(supabase, [lastUpdatedAsset]))[0] : null,
    post_media_row: lastPostMediaRow,
  });
  return response;
}

async function reorderPostMedia(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const postId = cleanString(body.post_id || body.postId);
  if (!postId) return { ok: false, error: "Missing post_id" };
  const orderedInput = Array.isArray(body.ordered_media_asset_ids)
    ? body.ordered_media_asset_ids
    : Array.isArray(body.orderedMediaAssetIds)
    ? body.orderedMediaAssetIds
    : [];
  const rawIds = orderedInput.map(String).map((value) => value.trim()).filter(Boolean);
  if (!rawIds.length) return orderedAttachedMediaResponse(supabase, workspaceId, postId, { action: "reorder_post_media" });

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const { data: allAssets, error: allAssetsError } = await supabase
    .from("media_assets")
    .select("*")
    .eq("workspace_id", workspaceId);
  if (allAssetsError) throw enrichError(allAssetsError, { stage: "media_assets reorder all", workspace_id: workspaceId });
  const assetByAnyKey = new Map<string, MediaAsset>();
  const assetByUUID = new Map<string, MediaAsset>();
  (allAssets || []).forEach((asset: MediaAsset) => {
    const uuid = cleanString(asset.id);
    if (uuid && uuidPattern.test(uuid)) {
      assetByUUID.set(uuid, asset);
      assetByAnyKey.set(uuid, asset);
    }
    [asset.asset_id, asset.assetId].map(cleanString).filter(Boolean).forEach((key) => assetByAnyKey.set(key, asset));
    const sp = cleanString(asset.storage_path);
    if (sp) assetByAnyKey.set(sp, asset);
  });

  const resolvedIds: string[] = [];
  for (const raw of rawIds) {
    const byAsset = assetByAnyKey.get(raw);
    const uuid = byAsset ? cleanString(byAsset.id) : uuidPattern.test(raw) ? raw : "";
    if (uuid) resolvedIds.push(uuid);
  }

  for (let index = 0; index < resolvedIds.length; index += 1) {
    const mediaAssetId = resolvedIds[index];
    const asset = assetByUUID.get(mediaAssetId);
    if (!asset) continue;
    const { error } = await supabase
      .from("post_media")
      .upsert({
        workspace_id: workspaceId,
        post_id: postId,
        media_asset_id: mediaAssetId,
        sort_order: index,
      }, { onConflict: "workspace_id,post_id,media_asset_id" });
    if (error) throw enrichError(error, { stage: "post_media reorder upsert", workspace_id: workspaceId, post_id: postId, media_asset_id: mediaAssetId });
    const { error: linkError } = await supabase
      .from("media_assets")
      .update({ linked_post_id: postId, post_id: postId, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", mediaAssetId);
    if (linkError) throw enrichError(linkError, { stage: "media_assets reorder relink", workspace_id: workspaceId, media_asset_id: mediaAssetId });
  }

  const response = await orderedAttachedMediaResponse(supabase, workspaceId, postId, {
    action: "reorder_post_media",
    reordered_media_asset_ids: resolvedIds,
  });
  return response;
}

function normalizeIdInput(value: unknown) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  if (typeof value === "number") return [String(value)];
  if (typeof value === "object" && !Array.isArray(value)) return [value];
  return [String(value)];
}

function detachCandidatePayloadsFromBody(body: Record<string, unknown>) {
  const candidates: Record<string, unknown>[] = [];
  const extractIds = (key: string) => {
    const raw = body[key];
    if (raw === undefined || raw === null) return;
    const items = normalizeIdInput(raw);
    for (const item of items) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        candidates.push(item as Record<string, unknown>);
      } else if (cleanString(item)) {
        candidates.push({ media_asset_id: cleanString(item) });
      }
    }
  };
  extractIds("media_assets");
  extractIds("mediaAssets");
  extractIds("media");
  extractIds("media_asset_ids");
  extractIds("mediaAssetIds");
  extractIds("ids");
  if (!candidates.length) candidates.push(body);
  return candidates;
}

async function resolveDetachMediaAssetIds(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  const candidates = detachCandidatePayloadsFromBody(body);
  const resolvedIds = new Set<string>();
  const resolvedAssets: MediaAsset[] = [];
  const addAsset = (asset: MediaAsset | null | undefined) => {
    const id = cleanString(asset?.id);
    if (!id || resolvedIds.has(id)) return;
    resolvedIds.add(id);
    resolvedAssets.push(asset as MediaAsset);
  };

  for (const candidate of candidates) {
    const mediaAssetId = cleanString(candidate.media_asset_id || candidate.mediaAssetId || candidate.id);
    if (mediaAssetId) {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaAssetId)) {
        const { data, error } = await supabase
          .from("media_assets")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("id", mediaAssetId)
          .maybeSingle();
        if (error) throw enrichError(error, { stage: "media_assets detach resolve by id", workspace_id: workspaceId, media_asset_id: mediaAssetId });
        if (data) { addAsset(data); continue; }
        resolvedIds.add(mediaAssetId);
        continue;
      }
      const { data, error } = await supabase
        .from("media_assets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("id", [mediaAssetId])
        .maybeSingle();
      if (error) throw enrichError(error, { stage: "media_assets detach resolve by id", workspace_id: workspaceId, media_asset_id: mediaAssetId });
      if (data) { addAsset(data); continue; }
      resolvedIds.add(mediaAssetId);
      continue;
    }

    const assetId = cleanString(candidate.asset_id || candidate.assetId || candidate.media_id || candidate.mediaId);
    if (assetId) {
      const { data, error } = await supabase
        .from("media_assets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("asset_id", assetId)
        .maybeSingle();
      if (error) throw enrichError(error, { stage: "media_assets detach resolve by asset_id", workspace_id: workspaceId, asset_id: assetId });
      if (data) { addAsset(data); continue; }
    }

    const storagePath = cleanString(candidate.storage_path || candidate.storagePath);
    if (storagePath) {
      let query = supabase
        .from("media_assets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("storage_path", storagePath);
      const bucket = cleanString(candidate.bucket || body.bucket);
      if (bucket) query = query.eq("bucket", bucket);
      const { data, error } = await query.maybeSingle();
      if (error) throw enrichError(error, { stage: "media_assets detach resolve by storage_path", workspace_id: workspaceId, storage_path: storagePath });
      if (data) addAsset(data);
    }
  }

  return {
    mediaAssetIds: Array.from(resolvedIds),
    assets: resolvedAssets,
  };
}

async function detachAssetsFromPost(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  workspaceId: string,
  body: Record<string, unknown>,
) {
  console.log("[media-match] detach request", {
    workspace_id: workspaceId,
    post_id: cleanString(body.post_id || body.postId),
    media_asset_id: cleanString(body.media_asset_id || body.mediaAssetId || body.id),
    media_asset_ids_count: Array.isArray(body.media_asset_ids) ? body.media_asset_ids.length : Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds.length : Array.isArray(body.ids) ? body.ids.length : 0,
    media_objects_count: Array.isArray(body.media_assets) ? body.media_assets.length : Array.isArray(body.media) ? body.media.length : 0,
    asset_id: cleanString(body.asset_id || body.assetId),
    storage_path: cleanString(body.storage_path || body.storagePath),
  });
  const resolved = await resolveDetachMediaAssetIds(supabase, workspaceId, body);
  console.log("[media-match] normalized detach ids", resolved.mediaAssetIds);

  let postId = cleanString(body.post_id || body.postId);
  if (!postId) {
    postId = cleanString(resolved.assets.find((asset) => cleanString(asset.linked_post_id || asset.post_id))?.linked_post_id || resolved.assets.find((asset) => cleanString(asset.linked_post_id || asset.post_id))?.post_id);
  }

  if (!resolved.mediaAssetIds.length && !postId) {
    return { ok: true, action: "detach_from_post", detachedCount: 0, warning: "No valid media identifiers or post_id provided. Nothing to detach.", attached_media: [], post_media: [], remainingMedia: [], remainingPostMedia: [], post_id: "" };
  }

  let postMediaDeletedCount = 0;
  let postMediaRows: Record<string, unknown>[] = [];
  if (postId && resolved.mediaAssetIds.length) {
    const { data: existingRows, error: existingError } = await supabase
      .from("post_media")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .in("media_asset_id", resolved.mediaAssetIds);
    if (existingError) throw enrichError(existingError, { stage: "post_media detach existing check", workspace_id: workspaceId, post_id: postId });
    postMediaDeletedCount = (existingRows || []).length;

    const { error: deleteError } = await supabase
      .from("post_media")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("post_id", postId)
      .in("media_asset_id", resolved.mediaAssetIds);
    if (deleteError) throw enrichError(deleteError, { stage: "post_media detach delete", workspace_id: workspaceId, post_id: postId, media_asset_ids: resolved.mediaAssetIds });
  }

  let clearedAssets: MediaAsset[] = [];
  if (resolved.mediaAssetIds.length) {
    const { data: clearedLinkedAssets, error: clearError } = await supabase
      .from("media_assets")
      .update({ linked_post_id: null, post_id: null, updated_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .in("id", resolved.mediaAssetIds)
      .select("*");
    if (clearError) throw enrichError(clearError, { stage: "media_assets detach clear id", workspace_id: workspaceId, media_asset_ids: resolved.mediaAssetIds });
    clearedAssets = (clearedLinkedAssets || []) as MediaAsset[];
    if (!clearedAssets.length) {
      const { data: clearedByLink } = await supabase
        .from("media_assets")
        .update({ linked_post_id: null, post_id: null, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .in("id", resolved.mediaAssetIds)
        .eq("linked_post_id", postId)
        .select("*");
      clearedAssets = (clearedByLink || []) as MediaAsset[];
    }
    if (!clearedAssets.length) {
      const { data: clearedByPostId } = await supabase
        .from("media_assets")
        .update({ linked_post_id: null, post_id: null, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .in("id", resolved.mediaAssetIds)
        .eq("post_id", postId)
        .select("*");
      clearedAssets = (clearedByPostId || []) as MediaAsset[];
    }
  }

  const idsToRemove = Array.from(new Set(
    resolved.mediaAssetIds
      .concat(resolved.assets.map((asset) => cleanString(asset.asset_id || asset.assetId || asset.id)))
      .concat(clearedAssets.map((asset) => cleanString(asset.asset_id || asset.assetId || asset.id)))
      .filter(Boolean)
  ));
  if (idsToRemove.length) await removeMediaIdsFromPost(supabase, workspaceId, postId || "", idsToRemove);

  const response = await orderedAttachedMediaResponse(supabase, workspaceId, postId || "", {
    action: "detach_from_post",
    detachedCount: postMediaDeletedCount,
    detached_assets: await resolveUrlsForAssets(supabase, clearedAssets || []),
    detached_media_asset_ids: resolved.mediaAssetIds,
    warning: postMediaDeletedCount === 0 && resolved.mediaAssetIds.length > 0 ? "No matching post_media rows were found for these media IDs. linked_post_id may have been cleared." : undefined,
  });
  console.log("[media-match] detach response", {
    post_id: postId,
    detachedCount: postMediaDeletedCount,
    detached_media_asset_ids: resolved.mediaAssetIds,
    attached_count: Array.isArray(response.attached_media) ? response.attached_media.length : 0,
  });
  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: Record<string, unknown> = {};
  let action = "list_assets";
  let workspaceId = "";
  try {
    body = await readBody(req);
    action = cleanString(body.action || "list_assets");
    workspaceId = cleanString(body.workspace_id);
    if (!workspaceId) return json({ ok: false, error: "Missing workspace_id" }, 400);

    const user = await getAuthUser(req);
    const supabase = getSupabaseServiceClient();
    await requireWorkspaceMember(supabase, workspaceId, user.id);

    if (action === "index_bucket") return json(await indexBucket(supabase, workspaceId, body, user.id || ""));
    if (action === "list_assets") return json(await listAssets(supabase, workspaceId, body));
    if (action === "create_asset") return json(await createAsset(supabase, workspaceId, body, user.id || ""));
    if (action === "attach_to_post") {
      try {
        return json(await attachAssetToPost(supabase, workspaceId, body, user.id || ""));
      } catch (err) {
        console.error("[media-match] attach error full object", serializeError(err));
        throw err;
      }
    }
    if (action === "reorder_post_media") {
      return json(await reorderPostMedia(supabase, workspaceId, body));
    }
    if (action === "detach_from_post") {
      try {
        return json(await detachAssetsFromPost(supabase, workspaceId, body));
      } catch (err) {
        console.error("[media-match] detach error full object", serializeError(err));
        throw err;
      }
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
    const message = err instanceof Error ? err.message : "Media index failed";
    const enriched = err as Error & Record<string, unknown>;
    const responseWorkspaceSlug = cleanString(body.workspace_slug || body.workspaceSlug || enriched.workspace_slug);
    const responseBucket = cleanString(enriched.bucket || body.bucket || DEFAULT_BUCKET);
    const responsePrefix = cleanString(enriched.prefix || body.prefix);
    console.error("[media-index] error", message);
    if (action === "index_bucket") {
      const fallbackBucket: BucketResolution = {
        bucket: responseBucket || DEFAULT_BUCKET,
        configuredBucket: cleanString(body.bucket) || CONFIGURED_BUCKET,
        bucketExists: false,
        bucketFallbackUsed: (cleanString(body.bucket) || CONFIGURED_BUCKET) !== DEFAULT_BUCKET,
        warnings: [],
      };
      return json({
        ...baseDiagnostics(
          "index_bucket",
          workspaceId,
          responseWorkspaceSlug,
          fallbackBucket,
          responsePrefix,
        ),
        include_all: body.include_all === true,
        ok: false,
        error: message,
        stack: err instanceof Error ? err.stack : "",
        stage: cleanString(enriched.stage),
        errorDetail: serializeError(err),
        message,
      }, 400);
    }
    if (action === "list_assets") {
      return json({
        ok: false,
        action: "list_assets",
        workspace_id: workspaceId,
        workspace_slug: responseWorkspaceSlug,
        count: 0,
        bucketCounts: {},
        sampleAssets: [],
        assetsReturnedCount: 0,
        assets: [],
        bucket: responseBucket || DEFAULT_BUCKET,
        configuredBucket: cleanString(body.bucket) || CONFIGURED_BUCKET,
        bucketExists: false,
        bucketFallbackUsed: (cleanString(body.bucket) || CONFIGURED_BUCKET) !== DEFAULT_BUCKET,
        prefix: responsePrefix,
        error: message,
        stack: err instanceof Error ? err.stack : "",
        stage: cleanString(enriched.stage),
        errorDetail: serializeError(err),
        message,
      }, 400);
    }
    return json({
      ok: false,
      error: message,
      stack: err instanceof Error ? err.stack : "",
      action,
      workspace_id: workspaceId,
      workspace_slug: responseWorkspaceSlug,
      bucket: responseBucket || DEFAULT_BUCKET,
      prefix: responsePrefix,
      stage: cleanString(enriched.stage),
      errorDetail: serializeError(err),
    }, 400);
  }
});
