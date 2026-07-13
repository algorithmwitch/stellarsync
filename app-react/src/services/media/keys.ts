import type { MediaFilters } from "@/types/media";

export const mediaKeys = {
  list: (workspaceId: string, filters: MediaFilters) => ["media", workspaceId, filters] as const,
  detail: (workspaceId: string, mediaId: string) => ["media", workspaceId, mediaId] as const,
  relationships: (workspaceId: string, postIds: string[]) =>
    ["post-media", workspaceId, [...postIds].sort().join(",")] as const,
};
