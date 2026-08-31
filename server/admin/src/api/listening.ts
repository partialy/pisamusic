import { fetchWithAuth, parseJson } from "./client";
import type { ListeningLevelConfig, ListeningLevelRule } from "../types/listening";

/** 服务端配置版本已被其他管理员更新时抛出。 */
export class ListeningLevelVersionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListeningLevelVersionConflictError";
  }
}

/** 读取当前听歌等级配置。 */
export async function fetchListeningLevelConfig(signal?: AbortSignal): Promise<ListeningLevelConfig> {
  const res = await fetchWithAuth("/api/admin/listening/levels", { signal });
  const body = await parseJson<ListeningLevelConfig>(res);
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}

/** 用完整规则集替换听歌等级配置。 */
export async function saveListeningLevelConfig(
  expectedVersion: number,
  rules: ListeningLevelRule[],
): Promise<ListeningLevelConfig> {
  const res = await fetchWithAuth("/api/admin/listening/levels", {
    method: "PUT",
    body: JSON.stringify({ expectedVersion, rules }),
  });
  const body = await parseJson<ListeningLevelConfig>(res);
  if (res.status === 409) {
    throw new ListeningLevelVersionConflictError(body.msg || "配置已被其他管理员更新，请刷新后再保存");
  }
  if (!res.ok || !body.success || body.data == null) {
    throw new Error(body.msg || `HTTP ${res.status}`);
  }
  return body.data;
}
