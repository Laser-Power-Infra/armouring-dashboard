import Link from "next/link";
import { MainNav } from "@/components/dash/main-nav";

const TABS = [
  { href: "/club-run", label: "Lots & orders" },
  { href: "/club-run/rules", label: "Rules" },
] as const;

/** Top bar of the Club & Run pages, with their sub-tabs. */
export function ClubRunHeader({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line-2 bg-surface">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <span className="hidden text-body font-semibold sm:inline">Kharagpur</span>
        <MainNav active="/club-run" />
      </div>
      <nav aria-label="Club & Run" className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center rounded-control px-2.5 text-label ${t.href === active ? "bg-primary-tint font-medium text-primary" : "text-ink-2 hover:bg-ground hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
