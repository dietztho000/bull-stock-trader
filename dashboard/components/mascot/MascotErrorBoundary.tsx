"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** What to render when the mascot subtree throws. Caller usually passes a
   *  layout-preserving placeholder (e.g. an empty div with the same
   *  className) so the surrounding nav/grid doesn't reflow. */
  fallback: ReactNode;
};

type State = { hasError: boolean };

/** Shields the mascot tree from SWR / localStorage / runtime failures.
 *  Without this, an Alpaca outage that blows up `useAccountSummary` inside
 *  the nav card would unmount the entire sidebar mascot slot — the bug
 *  flagged in audit T6. */
export class MascotErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[MascotErrorBoundary] suppressed", error, info.componentStack);
    }
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
