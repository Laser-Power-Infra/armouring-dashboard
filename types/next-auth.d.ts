import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: { id: string; role: string } & DefaultSession["user"];
  }
}

// next-auth/jwt only re-exports this; augment the source module.
declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
  }
}
