"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A menu anchored under its trigger. Native Popover API: the browser gives us the top layer
 * (never clipped by a scrolling table), Escape, outside click and focus return.
 * Trigger: any button with `popoverTarget={id}`.
 */
export function Popover({ id, onOpen, children, className = "" }: { id: string; onOpen?: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const opened = useRef(onOpen);
  useEffect(() => {
    opened.current = onOpen;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = (e: Event) => {
      if ((e as ToggleEvent).newState !== "open") return;
      const trigger = document.querySelector<HTMLElement>(`[popovertarget="${CSS.escape(id)}"]`);
      if (trigger) {
        const t = trigger.getBoundingClientRect();
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        // Under the trigger, kept on screen; above it when there is no room below.
        el.style.left = `${Math.max(8, Math.min(t.left, window.innerWidth - w - 8))}px`;
        el.style.top = `${t.bottom + 4 + h > window.innerHeight - 8 && t.top - 4 - h > 8 ? t.top - 4 - h : t.bottom + 4}px`;
      }
      opened.current?.();
    };
    el.addEventListener("toggle", place);
    return () => el.removeEventListener("toggle", place);
  }, [id]);

  return (
    <div
      ref={ref}
      id={id}
      popover="auto"
      className={`fixed inset-auto m-0 w-64 max-w-[calc(100vw-16px)] rounded-panel border border-line bg-surface p-1.5 text-ink shadow-[0_8px_28px_rgb(0_0_0/0.14)] ${className}`}
    >
      {children}
    </div>
  );
}
