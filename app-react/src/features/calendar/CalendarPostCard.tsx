import type { Post } from "@/types/posts";

type CalendarPostCardProps = {
  post: Post;
  onOpen(post: Post): void;
};

const statusClasses = {
  draft: "border-white/10 bg-white/5 text-stellar-muted",
  scheduled: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  published: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  archived: "border-white/10 bg-black/20 text-stellar-muted",
} as const;

export function CalendarPostCard({ post, onOpen }: CalendarPostCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      className="w-full rounded-2xl border border-stellar-border bg-stellar-panel-raised p-3 text-left hover:border-stellar-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-stellar-text-strong">
            {post.title || "Untitled post"}
          </div>
          <div className="mt-1 text-xs text-stellar-muted">
            {post.platform === "unknown" ? "Platform TBD" : post.platform}
          </div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase ${statusClasses[post.status]}`}>
          {post.status}
        </span>
      </div>
    </button>
  );
}
