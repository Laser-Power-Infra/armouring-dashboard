import { signIn } from "@/auth";

// Reads searchParams at request time; render on the server instead of prerendering a shell.
export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border p-6"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl ?? "/dashboard/arm5" });
        }}
      >
        <h1 className="text-xl font-semibold">Armouring 5 Dashboard</h1>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            Sign-in failed. Use your {process.env.ALLOWED_GOOGLE_DOMAIN} Google account.
          </p>
        )}
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-white hover:bg-neutral-800"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
