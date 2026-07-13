import type { PropsWithChildren, ReactNode } from "react";
import { Component } from "react";

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
        <div className="screen-center">
          <div className="panel">
            <h1>React app failed to load</h1>
            <p>{this.state.error.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

