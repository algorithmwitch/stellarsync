type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="screen-center">
      <div className="panel">
        <p>{label}</p>
      </div>
    </div>
  );
}

