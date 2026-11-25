import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import wasm from "vite-plugin-wasm";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      {
        name: "fix-lyric-html-paths",
        enforce: "post",
        generateBundle(_options, bundle) {
          for (const [fileName, file] of Object.entries(bundle)) {
            if (
              (fileName.includes("lyric-window.html") ||
                fileName.includes("startup-window.html")) &&
              file.type === "asset" &&
              typeof file.source === "string"
            ) {
              file.source = file.source
                .replace(/src="\//g, 'src="../')
                .replace(/href="\//g, 'href="../');
            }
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "electron/main.ts"),
          store: resolve(__dirname, "electron/store/index.ts"),
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
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload.ts"),
          "desktop-lyric": resolve(__dirname, "electron/desktopLyric/preload.ts"),
          "startup-window": resolve(__dirname, "electron/startup/preload.ts"),
        },
        output: {
          entryFileNames: "[name].cjs",
          format: "cjs",
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
      rollupOptions: {
        input: {
          index: resolve(__dirname, "index.html"),
        },
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, "/");
            if (!normalizedId.includes("/node_modules/")) return;
            if (
              normalizedId.includes("/node_modules/naive-ui/") ||
              normalizedId.includes("/node_modules/seemly/") ||
              normalizedId.includes("/node_modules/vooks/") ||
              normalizedId.includes("/node_modules/evtd/") ||
              normalizedId.includes("/node_modules/treemate/") ||
              normalizedId.includes("/node_modules/css-render/")
            ) {
              return "naive-ui";
            }
            if (
              normalizedId.includes("/node_modules/lucide-vue-next/") ||
              normalizedId.includes("/node_modules/@vicons/")
            ) {
              return "icons";
            }
            if (
              normalizedId.includes("/node_modules/@applemusic-like-lyrics/") ||
              normalizedId.includes("/node_modules/@pixi/")
            ) {
              return "amll";
            }
            if (
              /\/node_modules\/(?:vue|@vue|vue-router|pinia)\//.test(normalizedId)
            ) {
              return "vue-vendor";
            }
          },
        },
      },
    },
    plugins: [
      vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === "webview" } } }),
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
        dts: false,
      }),
    ],
  },
});
