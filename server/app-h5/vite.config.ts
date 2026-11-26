import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/h5/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../web-h5",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:53380",
        changeOrigin: true,
      },
    },
  },
});
