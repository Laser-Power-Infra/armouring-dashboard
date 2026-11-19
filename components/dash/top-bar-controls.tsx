"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Machine is a choice on the screen (md §9): the same dashboard serves Armouring 1, 4, 6. */
export function MachinePicker({ current, machines }: { current: string; machines: { code: string; label: string }[] }) {
  const router = useRouter();
  if (machines.length < 2) return null;
  return (
    <label className="relative">
      <span className="sr-only">Machine</span>
      <select
        value={current}
        onChange={(e) => router.push(`/dashboard/${e.target.value.toLowerCase()}`)}
        className="appearance-none rounded-full bg-surface-2 py-1.5 pl-3 pr-8 text-[14px] font-medium text-ink"
      >
        {machines.map((m) => (
          <option key={m.code} value={m.code}>
            {m.label}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}

/** Re-reads every block from the database. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => start(() => router.refresh())}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-accent hover:bg-surface-2 disabled:opacity-60"
    >
      <svg className={pending ? "animate-spin motion-reduce:animate-none" : ""} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
        <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4h-4" />
      </svg>
      {pending ? "Refreshing" : "Refresh"}
    </button>
  );
}
