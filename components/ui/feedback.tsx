import type { ReactNode } from "react";
import { Button } from "./button";

/** Placeholder rows while the first load is on its way. */
export function Skeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 animate-pulse bg-line-2 motion-reduce:animate-none" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Nothing to show: say what fills it, or how to get rows back. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-label text-ink-2">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** A failed load: the problem, and the way out. */
export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-control bg-critical-bg px-3 py-2 text-label text-critical">
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
