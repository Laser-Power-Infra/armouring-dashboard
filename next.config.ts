import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Opening the dev server from this machine's LAN address keeps hot reload working.
  allowedDevOrigins: ["192.168.1.200"],
  // "/" has no page of its own; send it to the default machine.
  async redirects() {
    return [{ source: "/", destination: "/dashboard/arm5", permanent: false }];
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
