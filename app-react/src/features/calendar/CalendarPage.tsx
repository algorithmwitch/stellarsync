import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/Card/Card";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { CalendarMonthView } from "@/features/calendar/CalendarMonthView";
import { CalendarToolbar } from "@/features/calendar/CalendarToolbar";
import {
  getMonthRange,
  getVisibleDays,
  getWeekRange,
  shiftAnchor,
  toDateKey,
  type CalendarViewMode,
} from "@/features/calendar/calendar-utils";
import { PostEditorModal } from "@/features/posts/editor/PostEditorModal";
import { postKeys } from "@/services/posts/keys";
import { fetchCalendarPosts } from "@/services/posts/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { Post } from "@/types/posts";

function getPostDate(post: Post) {
  if (post.publishDate) return post.publishDate;
  if (post.scheduledAt) return post.scheduledAt.slice(0, 10);
  return "";
}

export default function CalendarPage() {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspace?.workspaceId || "");
  const [view, setView] = useState<CalendarViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);

  const range = view === "week" ? getWeekRange(anchor) : getMonthRange(anchor);
  const postsQuery = useQuery({
    queryKey: postKeys.calendar(workspaceId, range),
    queryFn: () => fetchCalendarPosts(workspaceId, range),
    enabled: Boolean(workspaceId),
  });

  const visibleDays = useMemo(() => getVisibleDays(anchor, view), [anchor, view]);
  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of postsQuery.data || []) {
      const key = getPostDate(post);
      if (!key) continue;
      const next = map.get(key) || [];
      next.push(post);
      map.set(key, next);
    }
    return map;
  }, [postsQuery.data]);

  const label = useMemo(
    () =>
      view === "week"
        ? `${new Date(`${range.start}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })} - ${new Date(`${range.end}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`
        : anchor.toLocaleDateString([], { month: "long", year: "numeric" }),
    [anchor, range.end, range.start, view],
  );

  if (!workspaceId) return <LoadingState label="Resolving workspace" />;
  if (postsQuery.isLoading) return <LoadingState label="Loading calendar posts" />;

  return (
    <section className="grid gap-4">
      <CalendarToolbar
        label={label}
        view={view}
        onViewChange={setView}
        onPrevious={() => setAnchor((current) => shiftAnchor(current, view, -1))}
        onToday={() => setAnchor(new Date())}
        onNext={() => setAnchor((current) => shiftAnchor(current, view, 1))}
      />

      <Card as="section" className="space-y-2">
        <div className="stellar-eyebrow">Visible range only</div>
        <p className="m-0 text-sm text-stellar-muted">
          This React calendar queries only the visible {view} range instead of loading the
          full historical post archive on boot.
        </p>
      </Card>

      <CalendarMonthView
        days={visibleDays}
        anchor={anchor}
        postsByDay={postsByDay}
        onOpen={(post) => setSelectedPost(post)}
        onCreate={(day) => {
          setSelectedPost(null);
          setCreateDate(toDateKey(day));
        }}
      />

      <PostEditorModal
        open={Boolean(selectedPost) || Boolean(createDate)}
        post={selectedPost}
        initialDate={createDate}
        onClose={() => {
          setSelectedPost(null);
          setCreateDate(null);
        }}
      />
    </section>
  );
}
