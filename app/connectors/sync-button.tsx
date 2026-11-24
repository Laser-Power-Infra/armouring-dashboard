"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { makeDashboardMaster, syncNow } from "./actions";

const secs = (ms: number) => (ms < 90_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);

/** Starts a full sync; shows the estimate (the last sync's duration) and the time running against it. */
export function SyncButton({ estimateMs }: { estimateMs: number | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pending]);

  const elapsed = Math.max(0, now - startedAt);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        loading={pending}
        onClick={() => {
          setError(null);
          setStartedAt(Date.now());
          setNow(Date.now());
          start(async () => setError(await syncNow()));
        }}
      >
        {pending ? "Syncing…" : "Sync now"}
      </Button>
      <span className="num text-label text-ink-2" aria-live="polite">
        {pending
          ? estimateMs
            ? elapsed > estimateMs
              ? `${secs(elapsed)} – taking longer than usual`
              : `${secs(elapsed)} of about ${secs(estimateMs)}`
            : `${secs(elapsed)}`
          : estimateMs
            ? `Takes about ${secs(estimateMs)} (last sync)`
            : "Time not known yet: shown after the first sync"}
      </span>
      {error && !pending && (
        <span role="alert" className="max-w-xl whitespace-pre-line text-caption text-critical">
          {error}
        </span>
      )}
    </div>
  );
}

/** Cutover button: Club & Run is kept in the dashboard from now on. */
export function MasterButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button loading={pending} onClick={() => start(async () => setError(await makeDashboardMaster()))}>
        Keep Club &amp; Run in the dashboard
      </Button>
      <span className="text-label text-ink-2">Starts from the last sync of the sheet. After this, syncs no longer overwrite lots and orders.</span>
      {error && !pending && (
        <span role="alert" className="text-caption text-critical">
          {error}
        </span>
      )}
    </div>
  );
}
