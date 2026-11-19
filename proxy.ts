export { auth as proxy } from "@/auth";

// The dashboard is public; only admin pages need a signed-in admin.
export const config = {
  matcher: ["/admin/:path*"],
};
