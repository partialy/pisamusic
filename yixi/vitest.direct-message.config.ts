import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["electron/directMessage/**/*.test.ts"],
    environment: "node",
  },
});
