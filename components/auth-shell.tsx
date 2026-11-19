import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[16px] text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none";
export const primaryButton =
  "w-full rounded-xl bg-accent px-4 py-2.5 text-[16px] font-semibold text-white hover:brightness-110 active:brightness-95";
export const secondaryButton =
  "flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-[16px] font-medium text-ink hover:bg-surface-2";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 text-center">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1 text-[15px] text-ink-2">{subtitle}</p>
        </div>
        <div className="rounded-[20px] bg-surface p-6">{children}</div>
      </div>
    </main>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[14px] font-medium text-ink-2">
      {label}
      {children}
    </label>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-critical-bg px-3.5 py-2.5 text-[14px] text-critical">
      {children}
    </p>
  );
}
