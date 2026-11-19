"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Spinner } from "./button";

// 16px text in controls: readable, and phones do not zoom the page on focus.
const control =
  "h-9 w-full rounded-control border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-3 " +
  "transition-colors duration-150 hover:border-ink-3 disabled:opacity-50 aria-invalid:border-critical";

/** A visible label above its control; an error names the problem under it. */
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-label font-medium text-ink-2">
      {label}
      {children}
      {error && (
        <span role="alert" className="font-normal text-critical">
          {error}
        </span>
      )}
    </label>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${control} ${className}`} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative inline-block ${className}`}>
      <select {...rest} className={`${control} appearance-none pr-8 text-label font-medium`}>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

export function Checkbox({ label, className = "", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className={`flex min-h-8 cursor-pointer items-center gap-2 text-label text-ink ${className}`}>
      <input type="checkbox" {...rest} className="size-4 shrink-0" />
      {label}
    </label>
  );
}

/** Search box. `pending` shows from the first keystroke, so a debounced search never looks dead. */
export function SearchInput({
  value,
  onChange,
  onSubmit,
  pending,
  label,
  placeholder = "Search",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  pending?: boolean;
  /** What a screen reader hears; the box itself shows the short placeholder. */
  label: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <span className={`relative block ${className}`}>
      <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
        <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4" />
      </svg>
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.()}
        className={`${control} px-8 [&::-webkit-search-cancel-button]:hidden`}
      />
      {pending && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-2" role="status" aria-label="Searching">
          <Spinner />
        </span>
      )}
    </span>
  );
}
