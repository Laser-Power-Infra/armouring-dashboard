import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(200), // same cap as sign-up; stops huge inputs reaching scrypt
});

/** Google sign-in only when its OAuth keys are configured; otherwise the button is hidden. */
export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials requires JWT sessions; roles ride on the token.
  session: { strategy: "jwt" },
  // Own cookie names: browsers share localhost cookies across ports, so another Auth.js
  // app on this machine would otherwise overwrite our session ("no matching decryption secret").
  cookies: Object.fromEntries(
    (["sessionToken", "callbackUrl", "csrfToken", "pkceCodeVerifier", "state", "nonce"] as const).map((k) => [k, { name: `arm.${k}` }]),
  ),
  pages: { signIn: "/login", error: "/login" },
  providers: [
    ...(googleEnabled ? [Google] : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await db.user.findUnique({ where: { email } });
        // Same null for unknown email, Google-only account, and wrong password.
        if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) return null;
        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    // Google accounts are linked by email, so only accept Google-verified emails.
    signIn({ account, profile }) {
      if (account?.provider === "google") return profile?.email_verified === true;
      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider === "google" && token.email) {
        const email = token.email.toLowerCase();
        const row = await db.user.upsert({
          where: { email },
          create: { email, name: token.name, lastLoginAt: new Date() }, // role: the table's default, viewer
          update: { lastLoginAt: new Date() },
        });
        token.sub = row.id;
      }
      // The role lives only in the users table and is read on every request, so a change there applies at once.
      if (token.sub) token.role = (await db.user.findUnique({ where: { id: token.sub }, select: { role: true } }))?.role ?? "viewer";
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role ?? "viewer";
      return session;
    },
    // Used by proxy.ts, which only guards /admin: the dashboard is readable by everyone.
    // Signed out -> login page. Signed in but not admin -> back to the dashboard, not a login loop.
    authorized({ auth, request }) {
      if (!auth?.user) return false;
      if (auth.user.role === "admin") return true;
      return Response.redirect(new URL("/club-run", request.nextUrl));
    },
  },
});
