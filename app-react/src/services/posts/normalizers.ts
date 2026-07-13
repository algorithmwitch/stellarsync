import type { MediaAsset, PostMediaRelationship } from "@/types/media";
import type { Post, PostMutationPayload, PostPlatform, PostStatus, PostType } from "@/types/posts";
import type { PostRow } from "@/services/posts/model";

function normalizePlatform(value: string | null | undefined): PostPlatform {
  const normalized = String(value || "").trim().toLowerCase();
  if (["linkedin", "instagram", "facebook", "threads", "x", "tiktok", "youtube"].includes(normalized)) {
    return normalized as PostPlatform;
  }
  if (!normalized) return "unknown";
  if (normalized.includes(",")) return "multi";
  return "unknown";
}

function normalizeStatus(value: string | null | undefined): PostStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "scheduled" || normalized === "published" || normalized === "failed" || normalized === "archived") {
    return normalized;
  }
  return "draft";
}

function normalizePostType(value: string | null | undefined, mediaCount: number): PostType {
  const normalized = String(value || "").trim().toLowerCase();
  if (["single_image", "single_video", "carousel", "text", "link", "story"].includes(normalized)) {
    return normalized as PostType;
  }
  if (mediaCount > 1) return "carousel";
  return "unknown";
}

export function normalizePost(
  row: PostRow,
  relationships: PostMediaRelationship[] = [],
  mediaAssets: MediaAsset[] = [],
): Post {
  const orderedRelationships = [...relationships].sort((a, b) => a.sortOrder - b.sortOrder);
  const orderedMedia = orderedRelationships
    .map((relationship) => mediaAssets.find((asset) => asset.id === relationship.mediaAssetId))
    .filter((asset): asset is MediaAsset => Boolean(asset));
  const mediaIds = orderedMedia.map((asset) => asset.id);
  const mediaUrls = orderedMedia.map((asset) => asset.mediaUrl || asset.previewUrl || "").filter(Boolean);
  const primaryAsset = orderedMedia[0] || null;

  return {
    id: row.id,
    postId: String(row.post_id || row.id).trim(),
    workspaceId: row.workspace_id,
    workspaceSlug: row.workspace_slug || null,
    title: String(row.title || "").trim(),
    description: String(row.description || "").trim(),
    platform: normalizePlatform(row.platform),
    platformTargets: Array.isArray(row.platform_targets) ? row.platform_targets.filter(Boolean) : [],
    status: normalizeStatus(row.status || row.publish_status),
    publishStatus: String(row.publish_status || row.status || "draft").trim(),
    postType: normalizePostType(row.post_type || row.format, mediaIds.length),
    publishDate: row.publish_date || null,
    publishTime: row.publish_time || null,
    scheduledAt: row.scheduled_at || null,
    publishedAt: row.published_at || null,
    campaignId: row.campaign_id || null,
    campaignName: row.campaign_name || null,
    pillar: row.pillar || null,
    mediaId: row.media_id || primaryAsset?.id || null,
    mediaIds,
    mediaUrl: row.media_url || primaryAsset?.mediaUrl || primaryAsset?.previewUrl || null,
    mediaUrls,
    storagePath: row.storage_path || primaryAsset?.storagePath || null,
    mediaType: row.media_type || primaryAsset?.mediaType || null,
    mediaFilename: row.media_filename || primaryAsset?.fileName || null,
    mediaAltText: row.media_alt_text || primaryAsset?.altText || null,
    mondayItemId: row.monday_item_id || null,
    mondaySyncStatus: row.monday_sync_status || null,
    notes: String((row.metadata || {}).notes || "").trim() || null,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function buildPostMutationRow(
  workspaceId: string,
  workspaceSlug: string,
  payload: PostMutationPayload,
  postId?: string,
) {
  return {
    workspace_id: workspaceId,
    workspace_slug: workspaceSlug || null,
    ...(postId ? { post_id: postId } : {}),
    title: payload.title || null,
    description: payload.description || null,
    platform: payload.platform || null,
    platform_targets: payload.platformTargets,
    status: payload.status,
    publish_status: payload.status,
    post_type: payload.postType || null,
    format: payload.postType || null,
    publish_date: payload.publishDate || null,
    publish_time: payload.publishTime || null,
    scheduled_at: payload.scheduledAt || null,
    campaign_id: payload.campaignId || null,
    campaign_name: payload.campaignName || null,
    pillar: payload.pillar || null,
    media_id: payload.mediaId || null,
    media_ids: payload.mediaIds,
    media_url: payload.mediaUrl || null,
    media_type: payload.mediaType || null,
    media_filename: payload.mediaFilename || null,
    media_alt_text: payload.mediaAltText || null,
    storage_path: payload.storagePath || null,
    metadata: {
      ...payload.metadata,
      notes: payload.notes || "",
      media_urls: payload.mediaUrls,
    },
  };
}
