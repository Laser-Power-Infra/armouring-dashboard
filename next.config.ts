import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Opening the dev server from this machine's LAN address keeps hot reload working.
  allowedDevOrigins: ["192.168.1.200", "192.168.1.123"],
  // Club & Run is the dashboard now; the old machine dashboard is retired and its URLs land there.
  async redirects() {
    return [
      { source: "/", destination: "/club-run", permanent: false },
      { source: "/dashboard/:path*", destination: "/club-run", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
