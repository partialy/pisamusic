import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import wasm from "vite-plugin-wasm";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "electron/main.ts"),
          store: resolve(__dirname, "electron/store/index.ts"),
          SPlyric: resolve(__dirname, "web/lyric.html"),
          lyric: resolve(__dirname, "web/lyric-window.html"),
          startup: resolve(__dirname, "web/startup-window.html"),
          logger: resolve(__dirname, "electron/utils/logger.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(__dirname, "electron/preload.ts"),
        formats: ["cjs"],
        fileName: "index.cjs",
      },
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload.ts"),
        },
      },
    },
  },
  renderer: {
    root: __dirname,
    server: {
      port: 30000,
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      rollupOptions:{
        input: {
          index: resolve(__dirname, "index.html")
        }
      }
    },
    plugins: [
      vue(),
      // @ts-ignore
      wasm(),
      AutoImport({
        imports: [
          "vue",
          {
            "naive-ui": [
              "useDialog",
              "useMessage",
              "useNotification",
              "useLoadingBar",
            ],
          },
        ],
      }),
      Components({
        resolvers: [NaiveUiResolver()],
      }),
    ],
    
  },
});
