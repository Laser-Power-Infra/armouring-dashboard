import type { ButtonHTMLAttributes } from "react";

// Feedback lives on the press (pointer-down), not on release.
const base =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-control text-label font-medium " +
  "transition-[background-color,border-color,transform,opacity] duration-150 ease-out active:scale-[0.97] " +
  "motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50";

const variants = {
  primary: "bg-primary text-white hover:bg-[color-mix(in_srgb,var(--primary)_88%,black)]",
  secondary: "border border-line bg-surface text-ink hover:border-ink-3 hover:bg-ground",
  quiet: "text-primary hover:bg-primary-tint",
} as const;

export type ButtonVariant = keyof typeof variants;

export const buttonClass = (variant: ButtonVariant = "secondary", className = "") => `${base} px-3.5 ${variants[variant]} ${className}`;

export function Button({
  variant = "secondary",
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClass(variant, className)}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Icon-only button: `label` is what a screen reader hears. */
export function IconButton({ label, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" {...rest} aria-label={label} title={label} className={`${base} w-9 text-ink-2 hover:bg-ground hover:text-ink ${className}`}>
      {children}
    </button>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg className="animate-spin motion-reduce:animate-none" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  );
}
