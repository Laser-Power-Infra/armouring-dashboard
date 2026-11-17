import { redirect } from "next/navigation";
import { auth } from "@/auth";

// shortcut: blocks on the session read; move it behind <Suspense> when the blocks land (Next 16 Cache Components).
export const instant = false;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { machine } = await params;

  // TODO(spec §10.2): compose dashboard blocks once loaders and the DB exist.
  return (
    <main className="p-4">
      <h1 className="text-2xl font-semibold">{machine.toUpperCase()} dashboard</h1>
      <p className="text-sm text-neutral-500">Signed in as {session.user?.email}</p>
    </main>
  );
}
