import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    include: [
      "src/desktopLyric/**/*.test.ts",
      "electron/desktopLyric/**/*.test.ts",
      "web/desktopLyric/**/*.test.ts",
    ],
    environment: "node",
  },
});
