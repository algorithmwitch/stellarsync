import { supabase } from "@/services/supabase/client";
import { normalizeMediaAsset, normalizePostMediaRelationship } from "@/services/media/normalizers";
import type { MediaAsset, MediaFilters, PostMediaRelationship } from "@/types/media";
import type { MediaAssetRow, PostMediaRow } from "@/services/media/model";

const MEDIA_SELECT =
  "id, asset_id, workspace_id, bucket, storage_path, media_url, thumbnail_url, filename, mime_type, media_type, alt_text, width, height, duration_seconds, linked_post_id, linked_note_id, linked_inspo_id, metadata, created_at, updated_at";

export async function fetchMediaAssets(
  workspaceId: string,
  filters: MediaFilters = {},
): Promise<{ items: MediaAsset[]; total: number }> {
  const limit = filters.limit ?? 24;
  const offset = filters.offset ?? 0;
  let query = supabase
    .from("media_assets")
    .select(MEDIA_SELECT, { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.mediaType && filters.mediaType !== "all") query = query.eq("media_type", filters.mediaType);
  if (filters.search) query = query.or(`filename.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    items: ((data || []) as MediaAssetRow[]).map(normalizeMediaAsset),
    total: count || 0,
  };
}

export async function fetchMediaAssetsByIds(workspaceId: string, mediaIds: string[]): Promise<MediaAsset[]> {
  if (!mediaIds.length) return [];
  const { data, error } = await supabase
    .from("media_assets")
    .select(MEDIA_SELECT)
    .eq("workspace_id", workspaceId)
    .in("id", mediaIds);
  if (error) throw error;
  return ((data || []) as MediaAssetRow[]).map(normalizeMediaAsset);
}

export async function fetchMediaRelationshipsForPosts(
  workspaceId: string,
  postIds: string[],
): Promise<PostMediaRelationship[]> {
  if (!postIds.length) return [];
  const { data, error } = await supabase
    .from("post_media")
    .select("id, workspace_id, post_id, media_asset_id, sort_order, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return ((data || []) as PostMediaRow[]).map(normalizePostMediaRelationship);
}
