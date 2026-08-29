import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["electron/system/requestHeaders.test.ts"],
    environment: "node",
  },
});
