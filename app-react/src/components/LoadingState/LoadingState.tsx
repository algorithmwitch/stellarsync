import { Card } from "@/components/Card/Card";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="grid min-h-screen place-items-center px-6 py-8">
      <Card className="flex w-full max-w-md items-center gap-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-stellar-accent-light" aria-hidden="true" />
        <p className="m-0 text-sm text-stellar-muted">{label}</p>
      </Card>
    </div>
  );
}
