import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../web-admin",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:53380",
        changeOrigin: true,
      },
      "/static": {
        target: "http://localhost:53380",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:53380",
        changeOrigin: true,
      },
    },
  },
});
