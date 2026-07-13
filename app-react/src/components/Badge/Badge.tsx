import type { HTMLAttributes, PropsWithChildren } from "react";

type BadgeTone = "connected" | "pending" | "error" | "neutral";

type BadgeProps = PropsWithChildren<
  HTMLAttributes<HTMLSpanElement> & {
    tone?: BadgeTone;
  }
>;

const toneClasses: Record<BadgeTone, string> = {
  connected: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  neutral: "border-white/10 bg-white/5 text-stellar-muted",
};

export function Badge({ children, className = "", tone = "neutral", ...props }: BadgeProps) {
  return (
    <span className={["stellar-badge", toneClasses[tone], className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}
