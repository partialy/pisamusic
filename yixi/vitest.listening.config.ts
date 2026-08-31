import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["electron/listening/**/*.test.ts"],
    environment: "node",
  },
});
