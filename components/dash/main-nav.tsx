import Link from "next/link";

/** The pages of the app: the machine dashboard and the four KGP cards. Shown in the top bar of every page. */
export const MAIN_NAV = [
  { href: "/dashboard/arm5", label: "Dashboard" },
  { href: "/cards/production", label: "Production cards" },
  { href: "/cards/labour", label: "Labour card" },
  { href: "/cards/drum-requirement", label: "Drum requirement" },
  { href: "/cards/drum-assembly", label: "Drum assembly" },
] as const;

export type MainHref = (typeof MAIN_NAV)[number]["href"];

/** `query` is carried on the card links, so a chosen card version stays chosen across the four cards. */
export function MainNav({ active, query = "" }: { active: MainHref; query?: string }) {
  return (
    <nav aria-label="Pages" className="flex min-w-0 gap-1 overflow-x-auto">
      {MAIN_NAV.map((t) => (
        <Link
          key={t.href}
          href={t.href.startsWith("/cards") ? `${t.href}${query}` : t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`inline-flex h-8 shrink-0 items-center rounded-control px-2.5 text-label ${t.href === active ? "bg-primary-tint font-medium text-primary" : "text-ink-2 hover:bg-ground hover:text-ink"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
