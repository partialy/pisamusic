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
  updateRepaired(task: PersistedDownloadTask, file: PersistedDownloadFile) {
    this.db.exec("BEGIN IMMEDIATE");
    try { this.save(task); this.saveFile(file); this.db.exec("COMMIT"); }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  removeFile(id: string) { this.db.prepare("DELETE FROM download_files WHERE file_id=?").run(id); }
  /** 同事务移除精确 legacy 行，避免兼容 read model 将已移除项重新显示。 */
  removeEntry(taskId: string, fileId?: string) {
    const task = this.task(taskId);
    const file = fileId ? this.file(fileId) : null;
    if (fileId && (!file || file.taskId !== taskId)) throw new Error("下载文件映射已变化");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (file) this.removeFile(file.fileId);
      this.removeTask(taskId);
      for (const id of new Set([task?.legacyId, file?.legacyId])) {
        if (id != null) this.db.prepare("DELETE FROM download_records WHERE id=?").run(id);
      }
      this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  removeTask(id: string) { this.db.prepare("DELETE FROM download_tasks WHERE task_id=? AND task_id NOT IN (SELECT task_id FROM download_files)").run(id); }
}
