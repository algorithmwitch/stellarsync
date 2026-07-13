type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

