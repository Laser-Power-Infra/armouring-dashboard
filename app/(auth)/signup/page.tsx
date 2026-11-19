import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { roleFor, signIn } from "@/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { AuthShell, Field, FormError, inputClass, primaryButton } from "@/components/auth-shell";

// Reads searchParams at request time; render on the server instead of prerendering a shell.
export const instant = false;

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(200),
});

// Fixed messages by code, so a crafted ?error= link cannot put arbitrary text on the page.
const errors: Record<string, string> = {
  name: "Enter your name.",
  email: "Enter a valid email.",
  password: "Password must be at least 8 characters.",
  taken: "This email is already registered. Sign in instead.",
};

async function signUp(formData: FormData) {
  "use server";
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/signup?error=${String(parsed.error.issues[0].path[0])}`);
  const { name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) {
    redirect("/signup?error=taken");
  }
  try {
    await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password), role: roleFor(email) },
    });
  } catch {
    // Unique violation from a parallel sign-up with the same email.
    redirect("/signup?error=taken");
  }
  await signIn("credentials", { email, password, redirectTo: "/dashboard/arm5" });
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <AuthShell title="Create an account" subtitle="Kharagpur armouring dashboard">
      <form action={signUp} className="flex flex-col gap-4">
        {error && <FormError>{errors[error] ?? "Sign-up failed. Try again."}</FormError>}
        <Field label="Name">
          <input name="name" required autoComplete="name" className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          <span className="text-[12px] font-normal text-ink-3">At least 8 characters</span>
        </Field>
        <button type="submit" className={primaryButton}>
          Create account
        </button>
        <p className="text-center text-[14px] text-ink-2">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
