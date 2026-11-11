import path from "node:path";
import { createHash } from "node:crypto";
import type { DbClient } from "../db/core/types";
import { atomicWrite, operationsRoot, readJson } from "./stateStore";

export interface OperationState {
  maintenance: boolean;
  taskId?: string;
  updatedAt: number;
}
let file: string | undefined;
let state: OperationState = { maintenance: false, updatedAt: 0 };
/** 旧全局 state.json 不再参与运行准入；副本在不同引擎中分别维护。 */
export async function bindOperationDatabase(db: DbClient): Promise<void> {
  const row = await db.queryOne<{installation_id:string}>("SELECT installation_id FROM app_installation WHERE id=1");
  if (!row) throw new Error("数据库安装标识缺失");
  const key = createHash("sha256").update(`${db.dialect}:${row.installation_id}`).digest("hex");
  file = path.join(operationsRoot, "states", key + ".json");
  state = readJson<OperationState>(file, { maintenance: false, updatedAt: 0 });
}
const resumeHooks: Array<() => Promise<void>> = [];
export function registerResumeHook(hook: () => Promise<void>): void { resumeHooks.push(hook); }
const hooks: Array<() => Promise<void>> = [];
let activeRequests = 0;
export function readOperationState(): OperationState { return { ...state }; }
export function isMaintenanceMode(): boolean { return state.maintenance; }
export function writeOperationState(patch: Partial<OperationState>): void {
  const next = { ...state, ...patch, updatedAt: Date.now() };
  if (!file) throw new Error("数据库维护状态尚未绑定");
  atomicWrite(file, next);
  state = next;
}
export function registerQuiesceHook(hook: () => Promise<void>): void { hooks.push(hook); }
export function trackBusinessRequest(): () => void {
  activeRequests++;
  let done = false;
  return () => { if (!done) { activeRequests--; done = true; } };
}
export async function enterMaintenance(taskId: string): Promise<void> {
  writeOperationState({ maintenance: true, taskId });
  for (const hook of hooks) await hook();
  const deadline = Date.now() + 60_000;
  while (activeRequests > 0) {
    if (Date.now() > deadline) throw new Error("在途请求未能排空，保留维护状态，请检查后重试");
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}
export async function exitMaintenance(): Promise<void> {
  for (const hook of resumeHooks) await hook();
  writeOperationState({ maintenance: false, taskId: undefined });
}
