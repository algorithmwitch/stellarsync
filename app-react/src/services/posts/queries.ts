import { supabase } from "@/services/supabase/client";
import { fetchMediaRelationshipsForPosts, fetchMediaAssetsByIds } from "@/services/media/queries";
import { normalizePost } from "@/services/posts/normalizers";
import type { CalendarRange, Post, PostFilters } from "@/types/posts";
import type { PostRow } from "@/services/posts/model";

const POST_SELECT =
  "id, workspace_id, workspace_slug, post_id, title, description, status, publish_status, publish_date, publish_time, scheduled_at, platform, platform_targets, campaign_id, campaign_name, pillar, format, post_type, media_id, media_ids, media_url, media_type, media_filename, media_alt_text, storage_path, monday_item_id, monday_sync_status, published_at, metadata, created_at, updated_at";

async function hydratePosts(rows: PostRow[]): Promise<Post[]> {
  const postIds = rows.map((row) => row.post_id).filter(Boolean);
  if (!postIds.length) return rows.map((row) => normalizePost(row));
  const workspaceId = rows[0]?.workspace_id || "";
  const relationships = await fetchMediaRelationshipsForPosts(workspaceId, postIds);
  const mediaIds = [...new Set(relationships.map((relationship) => relationship.mediaAssetId))];
  const mediaAssets = mediaIds.length ? await fetchMediaAssetsByIds(workspaceId, mediaIds) : [];
  return rows.map((row) =>
    normalizePost(
      row,
      relationships.filter((relationship) => relationship.postId === row.post_id),
      mediaAssets,
    ),
  );
}

export async function fetchPosts(workspaceId: string, filters: PostFilters = {}): Promise<Post[]> {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("workspace_id", workspaceId)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.platform && filters.platform !== "all") query = query.eq("platform", filters.platform);
  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return hydratePosts((data || []) as PostRow[]);
}

export async function fetchPost(workspaceId: string, postId: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("post_id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await hydratePosts([data as PostRow]);
  return post || null;
}

export async function fetchCalendarPosts(workspaceId: string, range: CalendarRange): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("workspace_id", workspaceId)
    .or(
      [
        `publish_date.gte.${range.start},publish_date.lte.${range.end}`,
        `scheduled_at.gte.${range.start}T00:00:00Z,scheduled_at.lte.${range.end}T23:59:59Z`,
      ].join(","),
    )
    .order("publish_date", { ascending: true, nullsFirst: false })
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return hydratePosts((data || []) as PostRow[]);
}
