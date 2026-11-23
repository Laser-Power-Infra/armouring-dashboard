"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A menu anchored under its trigger. Native Popover API: the browser gives us the top layer
 * (never clipped by a scrolling table), Escape, outside click and focus return.
 * It is positioned on the page, so it scrolls away with the table it belongs to.
 * Trigger: any button with `popoverTarget={id}`.
 */
export function Popover({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const edge = 8;
    const place = () => {
      const trigger = document.querySelector<HTMLElement>(`[popovertarget="${CSS.escape(id)}"]`);
      if (!trigger || !el.matches(":popover-open")) return;
      const t = trigger.getBoundingClientRect();
      const below = window.innerHeight - t.bottom - 4 - edge;
      const above = t.top - 4 - edge;
      // Under the trigger; above it only when the menu does not fit below and there is more room above.
      el.style.maxHeight = "none";
      const up = el.scrollHeight > below && above > below;
      // Never taller than the room it has: a long list scrolls inside the menu instead of leaving the screen.
      el.style.maxHeight = `${Math.max(120, up ? above : below)}px`;
      // Placed on the page, not on the screen: when the reader scrolls, the menu stays with its table.
      el.style.left = `${window.scrollX + Math.max(edge, Math.min(t.left, window.innerWidth - el.offsetWidth - edge))}px`;
      el.style.top = `${window.scrollY + (up ? Math.max(edge, t.top - 4 - el.offsetHeight) : t.bottom + 4)}px`;
    };
    // The menu grows after it opens (filter choices arrive from the server), so place it again whenever its content changes.
    const grown = new MutationObserver(place);
    const toggled = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") {
        place();
        grown.observe(el, { childList: true, subtree: true });
        window.addEventListener("resize", place);
      } else {
        grown.disconnect();
        window.removeEventListener("resize", place);
      }
    };
    el.addEventListener("toggle", toggled);
    return () => {
      el.removeEventListener("toggle", toggled);
      grown.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [id]);

  return (
    <div
      ref={ref}
      id={id}
      popover="auto"
      className={`absolute inset-auto m-0 w-64 max-w-[calc(100vw-16px)] overflow-y-auto rounded-panel border border-line bg-surface p-1.5 text-ink shadow-[0_8px_28px_rgb(0_0_0/0.14)] ${className}`}
    >
      {children}
    </div>
  );
}
