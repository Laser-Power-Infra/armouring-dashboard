import type { ReactNode } from "react";

/** The frame for sign-in and sign-up: one centred panel on the page ground. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <h1 className="text-page">{title}</h1>
          <p className="mt-1 text-body text-ink-2">{subtitle}</p>
        </div>
        <div className="rounded-panel border border-line-2 bg-surface p-6">{children}</div>
      </div>
    </main>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control bg-critical-bg px-3 py-2 text-label text-critical">
      {children}
    </p>
  );
}
