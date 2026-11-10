import { randomUUID } from "node:crypto";
import { atomicWrite, listJson, resourcePath } from "./stateStore";
import type { Source } from "./sqliteSnapshots";

export type TaskStatus = "PRECHECKING" | "QUIESCING" | "SNAPSHOTTING" | "INITIALIZING" | "IMPORTING" | "VERIFYING" | "READY_TO_SWITCH" | "FAILED" | "INTERRUPTED" | "CANCELLED";
export interface TableResult { name: string; sourceCount: number; targetCount?: number; status: string; error?: string; sourceHash?: string; targetHash?: string }
export interface MigrationTask {
  id: string; status: TaskStatus; source: Source; createdAt: number; updatedAt: number;
  totalRows: number; processedRows: number; tables: TableResult[]; logs: string[];
  snapshotId?: string; sourceSha256?: string; currentTable?: string; error?: string;
  schemaFingerprint?: string; targetFingerprint?: string; ownedTables: string[];
}
const finalStates = new Set<TaskStatus>(["READY_TO_SWITCH", "FAILED", "INTERRUPTED", "CANCELLED"]);
const tasks = new Map<string, MigrationTask>(listJson<MigrationTask>("tasks").map(t => [t.id, t]));
for (const task of tasks.values()) {
  if (!finalStates.has(task.status)) {
    task.status = "INTERRUPTED";
    task.error = "服务重启导致迁移中断，保持维护，请重新检查后重试";
    task.updatedAt = Date.now();
    atomicWrite(resourcePath("tasks", task.id), task);
  }
}
export function listTasks(): MigrationTask[] { return [...tasks.values()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,30); }
export function activeTask(): MigrationTask | undefined { return [...tasks.values()].find(t => !finalStates.has(t.status)); }
export function getTask(id: string): MigrationTask {
  const task = tasks.get(id);
  if (!task) throw new Error("迁移任务不存在");
  return task;
}
export function saveTask(task: MigrationTask, status?: TaskStatus, log?: string): void {
  if (status) task.status = status;
  if (log) task.logs = [...task.logs, new Date().toISOString() + " " + log].slice(-300);
  task.updatedAt = Date.now();
  atomicWrite(resourcePath("tasks", task.id), task);
  tasks.set(task.id, task);
}
export function newTask(source: Source): MigrationTask {
  if (activeTask()) throw new Error("已有迁移任务正在执行");
  const task: MigrationTask = { id: randomUUID(), source, status: "PRECHECKING", createdAt: Date.now(), updatedAt: Date.now(), totalRows:0, processedRows:0, tables:[], logs:[], ownedTables:[] };
  saveTask(task);
  return task;
}
