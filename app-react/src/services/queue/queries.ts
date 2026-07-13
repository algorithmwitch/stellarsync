import { supabase } from "@/services/supabase/client";
import type { QueueItem, QueueItemStatus } from "@/types/social";

type ScheduledRow = {
  id: string;
  workspace_id: string;
  post_id: string | null;
  source_id: string | null;
  social_account_id: string | null;
  provider: string | null;
  platform: string | null;
  status: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  caption: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeStatus(value: string | null | undefined): QueueItemStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (["scheduled", "publishing", "published", "failed", "cancelled", "draft"].includes(normalized)) {
    return normalized as QueueItemStatus;
  }
  return "draft";
}

export async function fetchQueueItems(workspaceId: string): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from("scheduled_social_posts")
    .select("id, workspace_id, post_id, source_id, social_account_id, provider, platform, status, scheduled_at, published_at, caption, error_message, metadata, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as ScheduledRow[]).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    postId: row.post_id,
    sourceId: row.source_id,
    socialAccountId: row.social_account_id,
    provider: row.provider,
    platform: row.platform,
    status: normalizeStatus(row.status),
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    caption: row.caption,
    errorMessage: row.error_message,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
