import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    globals: true,
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
      "test/**/*.test.ts"
    ],
    setupFiles: ["./vitest.setup.ts"],
    isolate: true,
    fileParallelism: true
  }
});
