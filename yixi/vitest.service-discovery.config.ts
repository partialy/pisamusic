import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "electron/system/serviceDiscovery/**/*.test.ts",
      "electron/updater/updaterConfig.test.ts",
    ],
    environment: "node",
  },
});
