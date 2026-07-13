import type { HTMLAttributes, PropsWithChildren } from "react";

type CardProps = PropsWithChildren<
  HTMLAttributes<HTMLElement> & {
    as?: "div" | "section" | "article";
    tone?: "panel" | "raised";
  }
>;

const toneClasses = {
  panel: "stellar-panel",
  raised: "stellar-card",
} as const;

export function Card({
  as = "div",
  children,
  className = "",
  tone = "panel",
  ...props
}: CardProps) {
  const Component = as;

  return (
    <Component className={[toneClasses[tone], className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Component>
  );
}
