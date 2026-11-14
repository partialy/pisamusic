import type { DatabaseSync } from "node:sqlite";
import type { PersistedDownloadTask, PersistedDownloadFile } from "./downloadTypes";

/** main 私有仓库；任务 JSON 是完整检查点，索引列只用于约束及排序。 */
export class DownloadRepository {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) { this.db = db; }
  tasks(): PersistedDownloadTask[] {
    return (this.db.prepare("SELECT data_json FROM download_tasks ORDER BY created_at,rowid").all() as { data_json: string }[]).map(row => JSON.parse(row.data_json));
  }
  task(id: string): PersistedDownloadTask | null {
    const row = this.db.prepare("SELECT data_json FROM download_tasks WHERE task_id=?").get(id) as { data_json: string } | undefined;
    return row ? JSON.parse(row.data_json) : null;
  }
  files(): PersistedDownloadFile[] {
    return (this.db.prepare("SELECT data_json FROM download_files ORDER BY rowid DESC").all() as { data_json: string }[]).map(row => JSON.parse(row.data_json));
  }
  file(id: string): PersistedDownloadFile | null { return this.files().find(file => file.fileId === id) ?? null; }
  save(task: PersistedDownloadTask) {
    this.db.prepare(`INSERT INTO download_tasks VALUES (?,?,?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET
      status=excluded.status,updated_at=excluded.updated_at,data_json=excluded.data_json`).run(
      task.taskId,task.legacyId,task.status,task.createdAt,task.updatedAt,JSON.stringify(task));
  }
  enqueue(tasks: PersistedDownloadTask[]) {
    this.db.exec("BEGIN IMMEDIATE");
    try { tasks.forEach(task => this.save(task)); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  complete(task: PersistedDownloadTask, file: PersistedDownloadFile) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.save(task);
      this.db.prepare("INSERT INTO download_files VALUES (?,?,?,?,?)").run(file.fileId,file.taskId,file.legacyId,file.filePath,JSON.stringify(file));
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  saveFile(file: PersistedDownloadFile) {
    this.db.prepare("UPDATE download_files SET file_path=?,data_json=? WHERE file_id=?").run(file.filePath,JSON.stringify(file),file.fileId);
  }
  removeFile(id: string) { this.db.prepare("DELETE FROM download_files WHERE file_id=?").run(id); }
  removeTask(id: string) { this.db.prepare("DELETE FROM download_tasks WHERE task_id=? AND task_id NOT IN (SELECT task_id FROM download_files)").run(id); }
}
