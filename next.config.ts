import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every owner page reads the session cookie and live data, so the
  // request-time rendering model fits better than Cache Components here.
  cacheComponents: false,
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
