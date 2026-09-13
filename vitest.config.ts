import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Node, not jsdom. There are no component tests in this project: see the
    // `application-testing` skill for why the seams are drawn where they are.
    environment: "node",
    setupFiles: ["tests/helpers/setup.ts"],
    // Tests share one database and truncate between cases, so they cannot run
    // in parallel against each other.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
