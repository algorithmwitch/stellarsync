import { CalendarPostCard } from "@/features/calendar/CalendarPostCard";
import { toDateKey } from "@/features/calendar/calendar-utils";
import type { Post } from "@/types/posts";

type CalendarDayCellProps = {
  day: Date;
  inCurrentMonth: boolean;
  posts: Post[];
  onOpen(post: Post): void;
  onCreate(day: Date): void;
};

export function CalendarDayCell({ day, inCurrentMonth, posts, onOpen, onCreate }: CalendarDayCellProps) {
  return (
    <div className={`min-h-44 rounded-3xl border p-3 ${inCurrentMonth ? "border-stellar-border bg-stellar-panel" : "border-stellar-border-soft bg-black/10"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className={`text-sm font-semibold ${inCurrentMonth ? "text-stellar-text-strong" : "text-stellar-muted"}`}>
          {day.toLocaleDateString([], { month: "short", day: "numeric" })}
        </div>
        <button
          type="button"
          className="rounded-xl border border-stellar-border px-2 py-1 text-[11px] text-stellar-muted hover:text-stellar-text"
          onClick={() => onCreate(day)}
          aria-label={`Create post for ${toDateKey(day)}`}
        >
          New
        </button>
      </div>
      <div className="grid gap-2">
        {posts.slice(0, 3).map((post) => (
          <CalendarPostCard key={post.id} post={post} onOpen={onOpen} />
        ))}
        {posts.length > 3 ? (
          <div className="px-2 text-xs text-stellar-muted">+{posts.length - 3} more posts</div>
        ) : null}
      </div>
    </div>
  );
}
