import { toSafeDownloadSong } from "../../src/utils/downloadSong";
import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { normalizeDownloadSettings } from "../../src/utils/downloadSettings";
import type { DownloadRecordRow } from "./types";
import type { PersistedDownloadTask, PersistedDownloadFile } from "./downloadTypes";

export function migrateDownloads(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM schema_migrations WHERE version=10").get()) return;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS download_tasks (
      task_id TEXT PRIMARY KEY, legacy_id INTEGER UNIQUE, status TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_download_tasks_fifo ON download_tasks(status,created_at,task_id);
      CREATE TABLE IF NOT EXISTS download_files (
      file_id TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE REFERENCES download_tasks(task_id),
      legacy_id INTEGER UNIQUE, file_path TEXT NOT NULL, data_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_download_files_path ON download_files(file_path);`);
    const rows = db.prepare("SELECT * FROM download_records ORDER BY id").all() as DownloadRecordRow[];
    for (const row of rows) {
      let payload;
      try { payload = JSON.parse(row.payload_json); } catch { payload = { id: row.song_id, source: row.source }; }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = { id: row.song_id, source: row.source };
      const legacyLyricPaths = Array.isArray(payload?.downloadLyricPaths) ? payload.downloadLyricPaths.filter((item: unknown) => typeof item === "string") : [];
      try { payload = toSafeDownloadSong({ ...payload, id: row.song_id, source: row.source }); }
      catch { payload = { id: row.song_id, source: row.source, name: String(payload?.name || "") }; }
      // 仅导入尚存的 legacy 行；不扫描用户目录或改写旧记录。
      const taskId = randomUUID();
      const fileId = row.status === "completed" && row.file_path ? randomUUID() : "";
      const task: PersistedDownloadTask = {
        taskId, fileId, source: row.source, songId: row.song_id, qualityKey: row.quality_key,
        name: String(payload.name || "未知歌曲"), status: fileId ? "completed" : row.status === "failed" ? "failed" : "paused",
        progress: fileId ? 100 : 0, receivedBytes: row.received_bytes || 0, totalBytes: row.total_bytes || 0,
        speedBytesPerSecond: 0, directory: row.download_directory, filePath: row.file_path || "",
        error: row.message || "", createdAt: row.created_at, updatedAt: row.updated_at,
        retryCount: 0, pauseReason: "历史记录迁移，需手动继续", generation: 0,
        payload, configuration: { namingMode: "artist-title", ...normalizeDownloadSettings() },
        partPath: "", extension: "", validator: "", validatorKind: "", transferComplete: Boolean(fileId),
        retryAt: 0, legacyId: row.id, candidateIdentity: "", candidateSize: 0, assets: [],
      };
      db.prepare("INSERT OR IGNORE INTO download_tasks VALUES (?,?,?,?,?,?)").run(taskId,row.id,task.status,task.createdAt,task.updatedAt,JSON.stringify(task));
      if (fileId) {
        const file: PersistedDownloadFile = {
          fileId, taskId, filePath: row.file_path, source: row.source, songId: row.song_id, qualityKey: row.quality_key,
          size: row.total_bytes || row.received_bytes || 0, durationMs: 0, metadataStatus: row.metadata_status,
          metadataJsonPath: row.metadata_json_path || "", coverPath: row.cover_path || "",
          lyricPaths: legacyLyricPaths.length ? legacyLyricPaths : row.lyric_path ? [row.lyric_path] : [],
          payload, completedAt: row.completed_at || row.updated_at, legacyId: row.id, message: row.message || "",
        };
        db.prepare("INSERT OR IGNORE INTO download_files VALUES (?,?,?,?,?)").run(fileId,taskId,row.id,row.file_path,JSON.stringify(file));
      }
    }
    db.prepare("INSERT INTO schema_migrations VALUES (10, 'persistent download tasks and files', ?)").run(new Date().toISOString());
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
