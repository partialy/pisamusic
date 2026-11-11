import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { atomicWrite, operationsRoot, readJson, resourcePath } from "./stateStore";
import type { Source } from "./sqliteSnapshots";

export type TaskStatus = "PRECHECKING" | "QUIESCING" | "SNAPSHOTTING" | "INITIALIZING" | "IMPORTING" | "VERIFYING" | "READY_TO_SWITCH" | "COMPLETED" | "FAILED" | "INTERRUPTED" | "CANCELLED";
export interface TableResult { name: string; sourceCount: number; targetCount?: number; status: string; error?: string; sourceHash?: string; targetHash?: string }
export interface MigrationTask {
  id: string; status: TaskStatus; source: Source; createdAt: number; updatedAt: number;
  totalRows: number; processedRows: number; tables: TableResult[]; logs: string[];
  snapshotId?: string; sourceSha256?: string; currentTable?: string; error?: string;
  schemaFingerprint?: string; targetFingerprint?: string; ownedTables: string[];
  mode?: "sync" | "switch"; sourceDialect?: "sqlite" | "mysql"; targetDialect?: "sqlite" | "mysql";
  targetBackupId?: string; scope?: string; targetUsable?: boolean;
}
const finalStates = new Set<TaskStatus>(["READY_TO_SWITCH", "COMPLETED", "FAILED", "INTERRUPTED", "CANCELLED"]);
const tasks = new Map<string, MigrationTask>();
let loaded=false;
function loadTasks():void{
  if(loaded)return;
  const dir=path.join(operationsRoot,"tasks");
  if(fs.existsSync(dir))for(const file of fs.readdirSync(dir).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n))){
    try{
      const task=readJson<MigrationTask>(path.join(dir,file));
      if(!task.id||!task.source||!Array.isArray(task.tables)||!Array.isArray(task.logs))throw new Error("旧任务格式无效");
      if(!finalStates.has(task.status)){
        task.status="INTERRUPTED";task.error="服务重启导致复制中断，请检查目标后重新执行";task.updatedAt=Date.now();
        atomicWrite(resourcePath("tasks",task.id),task);
      }
      tasks.set(task.id,task);
    }catch{console.warn("[database-migration] 历史任务无法读取，已保留原文件供人工检查");}
  }
  loaded=true;
}
export function listTasks(): MigrationTask[] { loadTasks();return [...tasks.values()].sort((a,b)=>b.createdAt-a.createdAt).slice(0,30); }
export function allTasks(): MigrationTask[] { loadTasks();return [...tasks.values()]; }
export function activeTask(): MigrationTask | undefined { loadTasks();return [...tasks.values()].find(t => !finalStates.has(t.status)); }
export function getTask(id: string): MigrationTask {
  loadTasks();
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
