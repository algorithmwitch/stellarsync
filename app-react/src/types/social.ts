export type QueueItemStatus =
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled"
  | "draft";

export type QueueItem = {
  id: string;
  workspaceId: string;
  postId: string | null;
  sourceId: string | null;
  socialAccountId: string | null;
  provider: string | null;
  platform: string | null;
  status: QueueItemStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  caption: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SocialPublishResult = {
  ok: boolean;
  id?: string;
  error?: string;
  message?: string;
};

export type ProviderCapabilities = {
  canPublishText: boolean;
  canPublishImage: boolean;
  canPublishVideo: boolean;
  canPublishCarousel: boolean;
  canPublishPersonal: boolean;
  canPublishOrganization: boolean;
  maxMediaCount: number | null;
  maxCaptionLength: number | null;
};
