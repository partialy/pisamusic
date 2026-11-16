import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["electron/power/**/*.test.ts"],
    environment: "node",
  },
});
