import { callEdgeFunction } from "@/services/supabase/edge";
import { supabase } from "@/services/supabase/client";
import type { SocialPublishResult } from "@/types/social";

export async function publishNow(workspaceId: string, postId: string): Promise<SocialPublishResult> {
  return callEdgeFunction<SocialPublishResult>("social-publish-now", {
    workspace_id: workspaceId,
    post_id: postId,
  });
}

export async function retryQueueItem(workspaceId: string, queueId: string): Promise<void> {
  const { error } = await supabase
    .from("scheduled_social_posts")
    .update({ status: "scheduled", error_message: null })
    .eq("workspace_id", workspaceId)
    .eq("id", queueId);
  if (error) throw error;
}

export async function cancelQueueItem(workspaceId: string, queueId: string): Promise<void> {
  const { error } = await supabase
    .from("scheduled_social_posts")
    .update({ status: "cancelled" })
    .eq("workspace_id", workspaceId)
    .eq("id", queueId);
  if (error) throw error;
}
