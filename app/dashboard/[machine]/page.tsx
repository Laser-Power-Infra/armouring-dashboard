import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth, signOut } from "@/auth";
import { getMachines, machineLabel } from "@/lib/dashboard/data";
import { SectionSkeleton } from "@/components/dash/section";
import { BlockBoundary } from "@/components/dash/block-boundary";
import { MachinePicker, RefreshButton } from "@/components/dash/top-bar-controls";
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
      <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Kharagpur</span>
          <MachinePicker current={machineCode} machines={machines} />
          <nav aria-label="Jump to" className="ml-2 hidden gap-1 md:flex">
            {jump.map((j) => (
              <a key={j.href} href={j.href} className="rounded-full px-3 py-1.5 text-[14px] text-ink-2 hover:bg-surface-2 hover:text-ink">
                {j.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <RefreshButton />
            {!session ? (
              <Link href="/login" className="rounded-full bg-ink px-3.5 py-1.5 text-[14px] font-medium text-surface hover:opacity-90">
                Sign in
              </Link>
            ) : (
              <details className="relative">
                <summary
                  className="grid size-8 place-items-center rounded-full bg-ink text-[13px] font-semibold uppercase text-surface"
                  aria-label={`Account: ${name}`}
                >
                  {name.slice(0, 1) || "?"}
                </summary>
                <div className="absolute right-0 top-10 w-60 rounded-2xl border border-line bg-surface p-2 shadow-xl">
                  <div className="px-3 py-2">
                    <div className="truncate text-[14px] font-medium">{session.user?.name ?? "Signed in"}</div>
                    <div className="truncate text-[12px] text-ink-2">{session.user?.email}</div>
                    <div className="mt-1 text-[12px] capitalize text-ink-3">{session.user?.role}</div>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await signOut({ redirectTo: "/dashboard/arm5" });
                    }}
                  >
                    <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-[14px] text-critical hover:bg-surface-2">
                      Sign out
                    </button>
                  </form>
                </div>
              </details>
            )}
          </div>
        </div>
        {/* phones: the jump links scroll sideways under the bar */}
        <nav aria-label="Jump to" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
          {jump.map((j) => (
            <a key={j.href} href={j.href} className="shrink-0 rounded-full bg-surface px-3 py-1 text-[13px] text-ink-2">
              {j.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 space-y-4 px-4 pb-16 pt-6 sm:px-6">
        <Block title="Summary" tall>
          <Summary machineCode={machineCode} />
        </Block>
        <Block title="Cable waiting along the line">
          <Pipeline machineCode={machineCode} />
        </Block>
        <Block title="Cable ready">
          <CableReady machineCode={machineCode} />
        </Block>
        <Block title="Cable waiting at earlier steps">
          <Upstream />
        </Block>
        <div className="grid gap-4 xl:grid-cols-2">
          <Block title="Output by step">
            <StageOutput machineCode={machineCode} />
          </Block>
          <Block title="Men and production">
            <MenVsProduction machineCode={machineCode} />
          </Block>
        </div>
        <Block title="Bobbins">
          <Bobbins machineCode={machineCode} />
        </Block>
        <Block title="Work left">
          <WorkLeft machineCode={machineCode} />
        </Block>
        <Block title="Latest production entries">
          <LatestEntries machineCode={machineCode} />
        </Block>
      </main>
    </>
  );
}

/** Each block loads on its own and fails on its own. */
function Block({ title, tall, children }: { title: string; tall?: boolean; children: ReactNode }) {
  return (
    <BlockBoundary title={title}>
      <Suspense fallback={<SectionSkeleton className={tall ? "h-64" : ""} />}>{children}</Suspense>
    </BlockBoundary>
  );
}
