import fs from "node:fs";
import path from "node:path";

export const operationsRoot = path.resolve(process.cwd(), "data/operations");

export function resourcePath(kind: string, id: string, extension = ".json"): string {
  if (!/^[a-z-]+$/.test(kind) || !/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("无效资源标识");
  return path.join(operationsRoot, kind, id + extension);
}

export function atomicWrite(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + ".tmp";
  const fd = fs.openSync(temp, "w", 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}

export function readJson<T>(file: string, fallback?: T): T {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && fallback !== undefined) return fallback;
    throw new Error("运维状态无法读取，保持关闭并检查状态文件");
  }
}

export function listJson<T>(kind: string): T[] {
  const dir = path.join(operationsRoot, kind);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => /^[a-zA-Z0-9-]+\.json$/.test(n)).map(n => readJson<T>(path.join(dir, n)));
}
