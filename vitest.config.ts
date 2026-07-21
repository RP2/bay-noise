import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  test: {
    // Use forks pool so NODE_OPTIONS (for --localstorage-file) propagates
    pool: "forks",
    // Use node environment for unit tests (no DOM needed for lib/* tests)
    // Component tests can override with // @vitest-environment happy-dom
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
