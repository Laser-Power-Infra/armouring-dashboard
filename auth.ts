import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// TODO(spec §11): roles (viewer/admin) come from the users table once the DB is set up.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      return (
        profile?.hd === process.env.ALLOWED_GOOGLE_DOMAIN &&
        profile?.email_verified === true
      );
    },
    // Used by proxy.ts: unauthenticated requests are redirected to /login.
    authorized: ({ auth }) => !!auth,
  },
});
