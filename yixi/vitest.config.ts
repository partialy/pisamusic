import { defineConfig } from "vitest/config";

// 一起听纯规则单元测试配置：只跑 src/listenTogether 下的无副作用规则，
// 不加载 electron-vite 配置，也不需要 DOM 环境。
export default defineConfig({
  test: {
    include: ["src/listenTogether/**/*.test.ts"],
    environment: "node",
  },
});
