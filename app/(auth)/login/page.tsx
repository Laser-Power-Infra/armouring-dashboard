import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { googleEnabled, signIn } from "@/auth";
import { AuthShell, FormError } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

// Reads searchParams at request time; render on the server instead of prerendering a shell.
export const instant = false;

/**
 * Where to go after sign-in. Auth.js sends a full URL (http://host/admin); we keep only its path,
 * so a crafted link can never send people to another site.
 */
function safeReturnPath(callbackUrl?: string) {
  if (!callbackUrl) return "/club-run";
  try {
    const u = new URL(callbackUrl, "http://local");
    return u.pathname.startsWith("/") && !u.pathname.startsWith("//") ? u.pathname + u.search : "/club-run";
  } catch {
    return "/club-run";
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  const redirectTo = safeReturnPath(callbackUrl);

  return (
    <AuthShell title="Sign in" subtitle="Kharagpur armouring dashboard">
      <div className="flex flex-col gap-4">
        {error && <FormError>{error === "CredentialsSignin" ? "Wrong email or password." : "Sign-in failed. Try again."}</FormError>}
        <form
          className="flex flex-col gap-4"
          action={async (formData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo,
              });
            } catch (e) {
              // Success throws Next's redirect; only auth failures are handled here.
              if (e instanceof AuthError) redirect(`/login?error=${e.type}`);
              throw e;
            }
          }}
        >
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <Button type="submit" variant="primary" className="h-10 w-full">
            Sign in
          </Button>
        </form>
        {googleEnabled && (
          <>
            <div className="flex items-center gap-3 text-label text-ink-2" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo });
              }}
            >
              <Button type="submit" className="h-10 w-full">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
                  <path
                    fill="#34A853"
                    d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23Z"
                  />
                  <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z" />
                  <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
                </svg>
                Continue with Google
              </Button>
            </form>
          </>
        )}
        <p className="text-center text-label text-ink-2">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
