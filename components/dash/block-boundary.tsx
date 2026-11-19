"use client";

import { Component, type ReactNode } from "react";

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
      <section className="rounded-[20px] bg-surface p-5 sm:p-6" role="alert">
        <h2 className="text-[17px] font-semibold">{this.props.title}</h2>
        <p className="mt-1 text-[14px] text-ink-2">This block could not be loaded. The database may have been waking up.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-full bg-surface-2 px-3.5 py-1.5 text-[14px] font-medium text-accent hover:brightness-95"
        >
          Try again
        </button>
      </section>
    );
  }
}
