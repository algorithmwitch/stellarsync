import type { CalendarRange, PostFilters } from "@/types/posts";

export const postKeys = {
  all: (workspaceId: string) => ["posts", workspaceId] as const,
  list: (workspaceId: string, filters: PostFilters) => ["posts", workspaceId, filters] as const,
  detail: (workspaceId: string, postId: string) => ["post", workspaceId, postId] as const,
  calendar: (workspaceId: string, range: CalendarRange) =>
    ["calendar-posts", workspaceId, range.start, range.end] as const,
};
