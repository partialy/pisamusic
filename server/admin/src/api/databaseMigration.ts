import type { ApiResponse } from "../types/api";
import { getStoredToken } from "../auth/token";
import { decrypt, randomFullKey } from "./crypto";
import { fetchWithAuth, parseJson } from "./client";

const PREFIX = "/api/admin/database-migration";

export type MigrationSource = {
  sourceType: "server" | "upload" | "snapshot";
  sourceId?: string;
};
export type SourceTable = {
  name: string;
  count: number;
  columns: string[];
  primaryKey: string[];
};
export type DatabaseSnapshot = {
  id: string;
  sha256: string;
  size: number;
  createdAt: number;
  tables: SourceTable[];
  checkpoint: string;
};
export type UploadedDatabase = {
  id: string;
  size: number;
  createdAt: number;
  tables: SourceTable[];
};
export type DatabaseStatus = {
  dbType: "SQLITE" | "MYSQL";
  sqliteFile?: string;
  maintenance: boolean;
  activeTaskId?: string;
  mysql: {
    configured: boolean;
    connected?: boolean;
    host?: string;
    port?: number;
    database?: string;
    version?: string;
    error?: string;
  };
  snapshots: DatabaseSnapshot[];
};
export type PreflightResult = {
  passed: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  tables: SourceTable[];
  totalRows: number;
};
export type TableResult = {
  name: string;
  status: string;
  sourceCount: number;
  targetCount?: number;
  error?: string;
  sourceHash?: string;
  targetHash?: string;
};
export type MigrationTask = {
  id: string;
  status: "PRECHECKING" | "QUIESCING" | "SNAPSHOTTING" | "INITIALIZING" | "IMPORTING" | "VERIFYING" | "READY_TO_SWITCH" | "FAILED" | "INTERRUPTED" | "CANCELLED";
  source: MigrationSource;
  createdAt: number;
  updatedAt: number;
  totalRows: number;
  processedRows: number;
  currentTable?: string;
  tables: TableResult[];
  logs: string[];
  error?: string;
  snapshotId?: string;
  sourceSha256?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(PREFIX + path, init);
  const payload = await parseJson<T>(response);
  if (!response.ok || !payload.success || payload.data == null) {
    throw new Error(payload.msg || `请求失败：HTTP ${response.status}`);
  }
  return payload.data;
}

const post = <T>(path: string, body: object): Promise<T> =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const fetchDatabaseStatus = (): Promise<DatabaseStatus> => request("/status");
export const preflightDatabase = (source: MigrationSource, retryTaskId?: string): Promise<PreflightResult> =>
  post("/preflight", { ...source, retryTaskId });
export const createDatabaseSnapshot = (source: MigrationSource): Promise<DatabaseSnapshot> =>
  post("/snapshots", source);
export const beginMigration = (source: MigrationSource, retryTaskId?: string): Promise<MigrationTask> =>
  post("/tasks", { ...source, retryTaskId, confirm: true });
export const listMigrationTasks = (): Promise<MigrationTask[]> => request("/tasks");
export const fetchMigrationTask = (id: string): Promise<MigrationTask> => request(`/tasks/${encodeURIComponent(id)}`);
export const exitDatabaseMaintenance = (): Promise<{ maintenance: boolean }> =>
  post("/maintenance/exit", { confirm: true });

export async function saveSnapshotFile(id: string): Promise<void> {
  const response = await fetchWithAuth(`${PREFIX}/snapshots/${encodeURIComponent(id)}/download`);
  if (!response.ok) {
    const body = await parseJson<unknown>(response);
    throw new Error(body.msg || "下载备份失败");
  }
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const extracted = /filename="?([^";]+)"?/i.exec(contentDisposition)?.[1];
  const name = extracted && /^[\w.-]+$/.test(extracted) ? extracted : `pm-backup-${id}.db`;
  const url = URL.createObjectURL(await response.blob());
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

export async function saveMigrationReport(id: string): Promise<void> {
  const task = await request<MigrationTask>(`/tasks/${encodeURIComponent(id)}/report`);
  const url = URL.createObjectURL(new Blob([JSON.stringify(task, null, 2)], { type: "application/json" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `pisa-migration-${id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

/** 现有 encryptedFetch 只接受 JSON；数据库文件单独传输，响应仍走 AES-GCM。 */
export function uploadDatabaseFile(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadedDatabase> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const secret = randomFullKey();
    xhr.open("POST", `${PREFIX}/uploads`, true);
    const token = getStoredToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-pm-random", secret);
    xhr.setRequestHeader("x-pm-enc-ver", "1");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.onload = () => {
      void (async () => {
        try {
          const envelope = JSON.parse(xhr.responseText) as { isEnc?: boolean; encData?: string };
          if (envelope.isEnc !== true || !envelope.encData) throw new Error("服务器未返回加密响应");
          const responseKey = xhr.getResponseHeader("x-pm-random");
          if (!responseKey) throw new Error("响应缺少加密密钥");
          const body = JSON.parse(await decrypt(responseKey, envelope.encData)) as ApiResponse<UploadedDatabase>;
          if (xhr.status < 200 || xhr.status >= 300 || !body.success || !body.data) {
            throw new Error(body.msg || `上传失败：HTTP ${xhr.status}`);
          }
          resolve(body.data);
        } catch (error) {
          reject(error);
        }
      })();
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
