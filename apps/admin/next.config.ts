import type { NextConfig } from "next";

// The admin panel is fully signed-in and per-request, so Cache Components /
// Partial Prefetching (static shells) bring no benefit here and are left off.
const nextConfig: NextConfig = {
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
