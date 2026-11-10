import path from "node:path";
import { atomicWrite, operationsRoot, readJson } from "./stateStore";

export interface OperationState {
  maintenance: boolean;
  taskId?: string;
  activatedMysql?: boolean;
  targetFingerprint?: string;
  updatedAt: number;
}
const file = path.join(operationsRoot, "state.json");
let state = readJson<OperationState>(file, { maintenance: false, updatedAt: 0 });
const hooks: Array<() => Promise<void>> = [];
let activeRequests = 0;
export function readOperationState(): OperationState { return { ...state }; }
export function isMaintenanceMode(): boolean { return state.maintenance; }
export function writeOperationState(patch: Partial<OperationState>): void {
  const next = { ...state, ...patch, updatedAt: Date.now() };
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
  if (state.activatedMysql) throw new Error("MySQL 已正式运行，禁止直接回退 SQLite");
  writeOperationState({ maintenance: false, taskId: undefined });
}
