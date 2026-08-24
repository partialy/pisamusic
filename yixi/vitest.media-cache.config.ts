import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "electron/mediaCache/**/*.test.ts",
      "src/utils/audioPlaybackPolicy.test.ts",
    ],
    environment: "node",
  },
});
