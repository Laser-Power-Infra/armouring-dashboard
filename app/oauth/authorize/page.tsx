import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { redirectAllowed, sign } from "@/lib/mcp/oauth";

// Reads searchParams and the session at request time; render on the server instead of prerendering a shell.
export const instant = false;

type Ask = { client_id?: string; redirect_uri?: string; state?: string; code_challenge?: string; code_challenge_method?: string; response_type?: string };

/** The request is one we can answer: a code flow with PKCE, going back to an allowed address. */
function valid(a: Ask): a is Ask & { client_id: string; redirect_uri: string; code_challenge: string } {
  return a.response_type === "code" && !!a.client_id && !!a.code_challenge && a.code_challenge_method === "S256" && redirectAllowed(a.redirect_uri ?? "");
}

async function allow(ask: Ask) {
  "use server";
  // Checked again here: a server action can be called without the page.
  const session = await auth();
  if (session?.user.role !== "admin" || !valid(ask)) redirect("/login");
  const back = new URL(ask.redirect_uri);
  back.searchParams.set("code", sign("code", session.user.id, { cc: ask.code_challenge, ru: ask.redirect_uri, cid: ask.client_id }));
  if (ask.state) back.searchParams.set("state", ask.state);
  redirect(back.toString());
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? sp[k] : undefined);
  const ask: Ask = {
    client_id: one("client_id"),
    redirect_uri: one("redirect_uri"),
    state: one("state"),
    code_challenge: one("code_challenge"),
    code_challenge_method: one("code_challenge_method"),
    response_type: one("response_type"),
  };

  if (!valid(ask)) {
    return (
      <AuthShell title="Cannot connect" subtitle="MD rules for Claude">
        <FormError>This connection request is not valid. Remove the connector in Claude and add it again.</FormError>
      </AuthShell>
    );
  }

  const session = await auth();
  if (!session?.user) {
    const here = "/oauth/authorize?" + new URLSearchParams(ask as Record<string, string>).toString();
    redirect("/login?callbackUrl=" + encodeURIComponent(here));
  }
  if (session.user.role !== "admin") {
    return (
      <AuthShell title="Cannot connect" subtitle="MD rules for Claude">
        <FormError>Only an admin can connect Claude to the MD rules. You are signed in as {session.user.email}.</FormError>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Connect Claude" subtitle="MD rules for Claude">
      <form action={allow.bind(null, ask)} className="flex flex-col gap-4">
        <p className="text-body text-ink">
          Claude will be able to read the MD rules, add and replace rules, and save rule summaries, as {session.user.email}.
        </p>
        <p className="text-label text-ink-2">After you allow, you go back to {new URL(ask.redirect_uri).host}.</p>
        <Button type="submit" variant="primary" className="h-10 w-full">
          Allow
        </Button>
      </form>
    </AuthShell>
  );
}
