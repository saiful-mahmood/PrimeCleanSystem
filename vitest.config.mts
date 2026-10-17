import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "app/**/*.test.tsx", "components/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**"],
    // Component tests opt into jsdom with `// @vitest-environment jsdom` at the top of the file.
    setupFiles: ["./vitest.setup.ts"],
    env: { TZ: "UTC" },
  },
});
