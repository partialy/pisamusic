import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["electron/playerControls/**/*.test.ts"],
    environment: "node",
  },
});
