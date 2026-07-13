import { supabase } from "@/services/supabase/client";
import { buildPostMutationRow } from "@/services/posts/normalizers";
import { fetchPost } from "@/services/posts/queries";
import type { Post, PostMutationPayload } from "@/types/posts";

function ensurePostId(value?: string) {
  return String(value || crypto.randomUUID()).trim();
}

async function replacePostMedia(workspaceId: string, postId: string, mediaIds: string[]) {
  const { error: deleteError } = await supabase
    .from("post_media")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("post_id", postId);
  if (deleteError) throw deleteError;

  if (!mediaIds.length) return;
  const rows = mediaIds.map((mediaAssetId, index) => ({
    workspace_id: workspaceId,
    post_id: postId,
    media_asset_id: mediaAssetId,
    sort_order: index,
  }));
  const { error: insertError } = await supabase.from("post_media").insert(rows);
  if (insertError) throw insertError;
}

export async function createPost(
  workspaceId: string,
  workspaceSlug: string,
  payload: PostMutationPayload,
): Promise<Post> {
  const postId = ensurePostId();
  const row = buildPostMutationRow(workspaceId, workspaceSlug, payload, postId);
  const { error } = await supabase.from("posts").insert(row);
  if (error) throw error;
  await replacePostMedia(workspaceId, postId, payload.mediaIds);
  const persisted = await fetchPost(workspaceId, postId);
  if (!persisted) throw new Error("Post was created but could not be reloaded.");
  return persisted;
}

export async function updatePost(
  workspaceId: string,
  workspaceSlug: string,
  postId: string,
  payload: PostMutationPayload,
): Promise<Post> {
  const row = buildPostMutationRow(workspaceId, workspaceSlug, payload, postId);
  const { error } = await supabase
    .from("posts")
    .update(row)
    .eq("workspace_id", workspaceId)
    .eq("post_id", postId);
  if (error) throw error;
  await replacePostMedia(workspaceId, postId, payload.mediaIds);
  const persisted = await fetchPost(workspaceId, postId);
  if (!persisted) throw new Error("Post was updated but could not be reloaded.");
  return persisted;
}

export async function deletePost(workspaceId: string, postId: string): Promise<void> {
  await replacePostMedia(workspaceId, postId, []);
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("post_id", postId);
  if (error) throw error;
}

export async function duplicatePost(
  workspaceId: string,
  workspaceSlug: string,
  post: Post,
): Promise<Post> {
  const duplicatedPayload: PostMutationPayload = {
    title: `${post.title || "Untitled"} Copy`,
    description: post.description,
    platform: post.platform,
    platformTargets: post.platformTargets,
    status: "draft",
    postType: post.postType,
    publishDate: post.publishDate,
    publishTime: post.publishTime,
    scheduledAt: post.scheduledAt,
    campaignId: post.campaignId,
    campaignName: post.campaignName,
    pillar: post.pillar,
    mediaId: post.mediaId,
    mediaIds: post.mediaIds,
    mediaUrl: post.mediaUrl,
    mediaUrls: post.mediaUrls,
    storagePath: post.storagePath,
    mediaType: post.mediaType,
    mediaFilename: post.mediaFilename,
    mediaAltText: post.mediaAltText,
    notes: post.notes,
    metadata: post.metadata,
  };
  return createPost(workspaceId, workspaceSlug, duplicatedPayload);
}
