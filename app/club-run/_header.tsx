import Link from "next/link";
import { MainNav } from "@/components/dash/main-nav";
import { AccountMenu } from "@/components/dash/account-menu";
import { inboxCount } from "@/lib/cached";

const TABS = [
  { href: "/club-run", label: "Plan" },
  { href: "/club-run/inbox", label: "New orders" },
  { href: "/club-run/lots", label: "Lots & orders" },
  { href: "/club-run/rules", label: "Rules" },
] as const;

/** Top bar of the Club & Run pages, with their sub-tabs. New orders carries a red count while any wait (plan 4a). */
export async function ClubRunHeader({ active }: { active: (typeof TABS)[number]["href"] }) {
  const waiting = await inboxCount();
  return (
    <header className="sticky top-0 z-20 border-b border-line-2 bg-surface print:static">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <span className="hidden text-body font-semibold sm:inline">Kharagpur</span>
        <MainNav active="/club-run" />
        <div className="ml-auto flex items-center gap-2">
          <AccountMenu />
        </div>
      </div>
      <nav aria-label="Club & Run" className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6 print:hidden">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-label ${t.href === active ? "bg-primary-tint font-medium text-primary" : "text-ink-2 hover:bg-ground hover:text-ink"}`}
          >
            {t.label}
            {t.href === "/club-run/inbox" && waiting > 0 && (
              <span className="num inline-flex min-w-5 items-center justify-center rounded-full bg-critical px-1.5 text-caption font-semibold text-white" aria-label={`${waiting} waiting`}>
                {waiting}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </header>
  );
}
