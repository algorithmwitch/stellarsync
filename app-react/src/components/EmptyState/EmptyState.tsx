import { Card } from "@/components/Card/Card";

type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <Card className="space-y-3">
      <h2 className="m-0 text-xl font-semibold text-stellar-text-strong">{title}</h2>
      <p className="m-0 text-sm leading-6 text-stellar-muted">{body}</p>
    </Card>
  );
}
