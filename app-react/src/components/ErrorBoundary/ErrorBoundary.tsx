import type { PropsWithChildren, ReactNode } from "react";
import { Component } from "react";
import { Card } from "@/components/Card/Card";

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center px-6 py-8">
          <Card className="w-full max-w-xl space-y-3">
            <h1 className="m-0 text-2xl font-semibold text-stellar-text-strong">React app failed to load</h1>
            <p className="m-0 text-sm leading-6 text-stellar-muted">{this.state.error.message}</p>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
