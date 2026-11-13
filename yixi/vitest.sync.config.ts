import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["electron/sync/**/*.test.ts"], environment: "node" },
});
