import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/components/home/homeAnnouncement.test.ts"],
    environment: "node",
  },
});
