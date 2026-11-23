"use client";

import { Component, type ReactNode } from "react";
import { ErrorNote } from "@/components/ui/feedback";

/**
 * One failed block must not blank the page (md §4: never show a blank).
 * Typical cause: the database was asleep and the first query timed out.
 */
export class BlockBoundary extends Component<{ title: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="rounded-panel border border-line-2 bg-surface p-5 sm:p-6">
        <h2 className="mb-3 text-title">{this.props.title}</h2>
        <ErrorNote message="This block could not be loaded. The database may have been waking up." onRetry={() => window.location.reload()} />
      </section>
    );
  }
}
