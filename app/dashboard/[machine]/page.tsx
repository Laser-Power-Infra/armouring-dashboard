import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth, signOut } from "@/auth";
import { getMachines, machineLabel } from "@/lib/dashboard/data";
import { BlockBoundary } from "@/components/dash/block-boundary";
import { MachinePicker, RefreshButton } from "@/components/dash/top-bar-controls";
import { Button, buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { Popover } from "@/components/ui/popover";
import { Summary } from "./_blocks/summary";
import { Pipeline } from "./_blocks/pipeline";
import { CableReady, Upstream } from "./_blocks/waiting";
import { MenVsProduction, StageOutput } from "./_blocks/output";
import { Bobbins } from "./_blocks/bobbins";
import { LatestEntries, WorkLeft } from "./_blocks/work";

// Readable by everyone (no login needed). Each block streams in behind its own Suspense boundary.
export const instant = false;

const jump = [
  { href: "#cable", label: "Cable" },
  { href: "#men", label: "Men" },
  { href: "#bobbins", label: "Bobbins" },
  { href: "#work", label: "Work left" },
  { href: "#entries", label: "Entries" },
];

// Panels in a row share its height; each lays out its own inside by the width it gets (container queries).
const GRID = "grid gap-6";

const jumpLink = "inline-flex h-8 shrink-0 items-center rounded-control px-2.5 text-label text-ink-2 hover:bg-ground hover:text-ink";

export default async function DashboardPage({ params }: { params: Promise<{ machine: string }> }) {
  // Live data and an optional session: render at request time (auth uses crypto, which cannot run in a prerender).
  await connection();
  // Public page: no session just means the top bar offers "Sign in".
  const session = await auth();
  const machineCode = (await params).machine.toUpperCase();
  // The picker is optional: if the database is still waking up, render the page without it.
  const machines = (await getMachines().catch(() => [] as string[])).map((code) => ({ code, label: machineLabel(code) }));
  // Unknown machine in the URL: 404 instead of an empty dashboard (only when the list is known).
  if (machines.length && !machines.some((m) => m.code === machineCode)) notFound();
  const name = session?.user?.name || session?.user?.email || "";

  return (
    <>
      {/* Translucent bar: content scrolls under it. Solid for readers who ask for less transparency. */}
      <header className="sticky top-0 z-20 border-b border-line-2 bg-surface/75 backdrop-blur-xl backdrop-saturate-[1.8] [@media(prefers-reduced-transparency:reduce)]:bg-surface [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <span className="hidden text-body font-semibold sm:inline">Kharagpur</span>
          <MachinePicker current={machineCode} machines={machines} />
          <nav aria-label="Jump to" className="ml-2 hidden gap-1 md:flex">
            {jump.map((j) => (
              <a key={j.href} href={j.href} className={jumpLink}>
                {j.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/cards/production" className={buttonClass("quiet")}>
              Cards
            </Link>
            <RefreshButton />
            {!session ? (
              <Link href="/login" className={buttonClass("secondary")}>
                Sign in
              </Link>
            ) : (
              <>
                <Button popoverTarget="account-menu" aria-label={`Account: ${name}`} className="w-9 px-0 uppercase">
                  {name.slice(0, 1) || "?"}
                </Button>
                <Popover id="account-menu">
                  <div className="px-2 py-1.5">
                    <div className="truncate text-label font-medium">{session.user?.name ?? "Signed in"}</div>
                    <div className="truncate text-caption font-normal text-ink-2">{session.user?.email}</div>
                    <div className="mt-1 text-caption font-normal capitalize text-ink-2">{session.user?.role}</div>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/dashboard/arm5" });
                    }}
                  >
                    <button type="submit" className="flex h-8 w-full items-center rounded-control px-2 text-left text-label text-critical hover:bg-ground">
                      Sign out
                    </button>
                  </form>
                </Popover>
              </>
            )}
          </div>
        </div>
        {/* phones: the jump links scroll sideways under the bar */}
        <nav aria-label="Jump to" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {jump.map((j) => (
            <a key={j.href} href={j.href} className={jumpLink}>
              {j.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="w-full flex-1 space-y-6 px-4 pb-16 pt-8 sm:px-6">
        <Block title="Summary" bare>
          <Summary machineCode={machineCode} />
        </Block>
        <Block title="Cable waiting along the line">
          <Pipeline machineCode={machineCode} />
        </Block>
        {/* The page uses the whole screen. Tables sit side by side once there is room: two across, three on very wide screens. */}
        <div className={`${GRID} min-[1440px]:grid-cols-2 min-[2200px]:grid-cols-3`}>
          <Block title="Cable ready">
            <CableReady machineCode={machineCode} />
          </Block>
          <Block title="Cable waiting at earlier steps">
            <Upstream machineCode={machineCode} />
          </Block>
        </div>
        <div className={`${GRID} min-[1700px]:grid-cols-2`}>
          <Block title="Output by step">
            <StageOutput machineCode={machineCode} />
          </Block>
          <Block title="Men and production">
            <MenVsProduction machineCode={machineCode} />
          </Block>
        </div>
        <div className={`${GRID} min-[1900px]:grid-cols-2`}>
          <Block title="Bobbins">
            <Bobbins machineCode={machineCode} />
          </Block>
          <Block title="Work left">
            <WorkLeft machineCode={machineCode} />
          </Block>
        </div>
        <Block title="Latest production entries">
          <LatestEntries machineCode={machineCode} />
        </Block>
      </main>
    </>
  );
}

/** Each block loads on its own and fails on its own. `bare`: the summary sits on the page, not in a panel. */
function Block({ title, bare, children }: { title: string; bare?: boolean; children: ReactNode }) {
  const loading = (
    <div className={bare ? "py-6" : "rounded-panel border border-line-2 bg-surface p-5 sm:p-6"}>
      <Skeleton rows={bare ? 3 : 5} />
    </div>
  );
  return (
    <BlockBoundary title={title}>
      <Suspense fallback={loading}>{children}</Suspense>
    </BlockBoundary>
  );
}
