import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.resolve(__dirname, "..");
const distDir = path.join(adminDir, "dist");
/** server/web（与 Express 静态目录一致） */
const webDir = path.resolve(adminDir, "..", "web");

if (!fs.existsSync(distDir)) {
  console.error("[deploy-web] 未找到 admin/dist，请先执行: pnpm run build");
  process.exit(1);
}

fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(webDir, { recursive: true });
fs.cpSync(distDir, webDir, { recursive: true });
console.log(`[deploy-web] 已清空并复制到 ${webDir}`);
