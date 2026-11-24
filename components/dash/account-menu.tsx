import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button, buttonClass } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";

/** Right end of every top bar: "Sign in", or the signed-in account with its role and Sign out. */
export async function AccountMenu() {
  const session = await auth();
  if (!session)
    return (
      <Link href="/login" className={buttonClass("secondary")}>
        Sign in
      </Link>
    );
  const name = session.user?.name || session.user?.email || "";
  return (
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
            await signOut({ redirectTo: "/club-run" });
          }}
        >
          <button type="submit" className="flex h-8 w-full items-center rounded-control px-2 text-left text-label text-critical hover:bg-ground">
            Sign out
          </button>
        </form>
      </Popover>
    </>
  );
}
