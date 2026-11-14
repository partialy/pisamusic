import path from "node:path";
import { lstat, realpath, stat } from "node:fs/promises";
export type FileIdentity = { canonicalPath: string; identity: string; size: number; keys: string[] };
type Lease = { owner: string; mode: "shared" | "exclusive" };
const locks = new Map<string, Set<Lease>>();
const pathKey = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
/** 任何路径段为符号链接/Windows junction 都保守拒绝，避免重解析点绕过。 */
export async function identifyFile(filePath: string, allowMissing = false): Promise<FileIdentity> {
  const resolved = path.resolve(filePath);
  let cursor = resolved;
  let missing = false;
  while (true) {
    try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error("文件路径包含符号链接或重解析点，禁止修改"); }
    catch (error: any) { if (error?.code === "ENOENT" && allowMissing) missing = true; else throw error; }
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
  if (missing) {
    const parent = await realpath(path.dirname(resolved));
    const canonicalPath = path.join(parent, path.basename(resolved));
    return { canonicalPath, identity: "", size: 0, keys: [`path:${pathKey(canonicalPath)}`] };
  }
  const canonicalPath = await realpath(resolved);
  const info = await stat(canonicalPath, { bigint: true });
  if (!info.isFile()) throw new Error("目标不是普通文件");
  const identity = `${info.dev}:${info.ino}`;
  return { canonicalPath, identity, size: Number(info.size), keys: [`path:${pathKey(canonicalPath)}`, `inode:${identity}`] };
}
export async function acquireFileLock(filePath: string, owner: string, mode: "shared" | "exclusive" = "exclusive", allowMissing = false) {
  const file = await identifyFile(filePath, allowMissing);
  for (const key of file.keys) {
    for (const lease of locks.get(key) ?? []) {
      if (lease.owner !== owner && (mode === "exclusive" || lease.mode === "exclusive")) throw new Error("文件正被下载、播放或其他操作占用");
    }
  }
  const lease: Lease = { owner, mode };
  for (const key of file.keys) { const set = locks.get(key) ?? new Set(); set.add(lease); locks.set(key, set); }
  let released = false;
  return { file, release() { if (released) return; released = true; for (const key of file.keys) { const set = locks.get(key); set?.delete(lease); if (!set?.size) locks.delete(key); } } };
}
