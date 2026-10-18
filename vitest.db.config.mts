import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests that talk to the hosted Supabase project (pnpm test:db).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
