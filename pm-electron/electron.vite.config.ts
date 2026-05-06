import path from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = __dirname;

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: path.resolve(root, "electron/main/index.ts"),
      },
    },
    resolve: {
      alias: {
        "@shared": path.resolve(root, "shared"),
        "@main": path.resolve(root, "electron/main"),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: path.resolve(root, "electron/preload/index.ts"),
      },
    },
    resolve: {
      alias: {
        "@shared": path.resolve(root, "shared"),
      },
    },
  },
  renderer: {
    root,
    build: {
      rollupOptions: {
        input: path.resolve(root, "index.html"),
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
        "@shared": path.resolve(root, "shared"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
