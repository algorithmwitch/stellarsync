export type PostStatus = "draft" | "scheduled" | "published" | "failed" | "archived";

export type PostPlatform =
  | "linkedin"
  | "instagram"
  | "facebook"
  | "threads"
  | "x"
  | "tiktok"
  | "youtube"
  | "multi"
  | "unknown";

export type PostType =
  | "single_image"
  | "single_video"
  | "carousel"
  | "text"
  | "link"
  | "story"
  | "unknown";

export type CarouselItem = {
  mediaAssetId: string;
  sortOrder: number;
};

export type Post = {
  id: string;
  postId: string;
  workspaceId: string;
  workspaceSlug: string | null;
  title: string;
  description: string;
  platform: PostPlatform;
  platformTargets: string[];
  status: PostStatus;
  publishStatus: string;
  postType: PostType;
  publishDate: string | null;
  publishTime: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  campaignId: string | null;
  campaignName: string | null;
  pillar: string | null;
  mediaId: string | null;
  mediaIds: string[];
  mediaUrl: string | null;
  mediaUrls: string[];
  storagePath: string | null;
  mediaType: string | null;
  mediaFilename: string | null;
  mediaAltText: string | null;
  mondayItemId: string | null;
  mondaySyncStatus: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CalendarRange = {
  start: string;
  end: string;
};

export type PostFilters = {
  status?: PostStatus | "all";
  platform?: PostPlatform | "all";
  campaignId?: string;
  search?: string;
};

export type PostMutationPayload = {
  title: string;
  description: string;
  platform: PostPlatform;
  platformTargets: string[];
  status: PostStatus;
  postType: PostType;
  publishDate: string | null;
  publishTime: string | null;
  scheduledAt: string | null;
  campaignId: string | null;
  campaignName: string | null;
  pillar: string | null;
  mediaId: string | null;
  mediaIds: string[];
  mediaUrl: string | null;
  mediaUrls: string[];
  storagePath: string | null;
  mediaType: string | null;
  mediaFilename: string | null;
  mediaAltText: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
};
