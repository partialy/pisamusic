import { randomUUID } from "node:crypto";
import { getAppDb } from "./appDb";
import type { DbClient, DbTransaction } from "./core/types";

export interface Installation {
  installation_id: string;
  initialized_at: number | null;
  transfer_status: "ready" | "incomplete";
  transfer_task_id: string | null;
  legacy_user_tokens: number;
}
export async function ensureInstallationSchema(db: DbClient, transferTaskId?: string): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS app_installation (
    id INTEGER PRIMARY KEY, installation_id VARCHAR(64) NOT NULL,
    initialized_at BIGINT NULL, transfer_status VARCHAR(16) NOT NULL,
    transfer_task_id VARCHAR(191) NULL, legacy_user_tokens INTEGER NOT NULL DEFAULT 0
  )${db.dialect === "mysql" ? " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin" : ""}`);
  await db.execute(`${db.dialect === "mysql" ? "INSERT IGNORE" : "INSERT OR IGNORE"} INTO app_installation
    (id,installation_id,initialized_at,transfer_status,transfer_task_id,legacy_user_tokens) VALUES (1,?,NULL,?,?,0)`, [randomUUID(), transferTaskId ? 'incomplete' : 'ready', transferTaskId ?? null]);
}
export async function readInstallation(db: DbTransaction = getAppDb()): Promise<Installation | null> {
  return db.queryOne<Installation>("SELECT * FROM app_installation WHERE id=1");
}
export async function markTransferIncomplete(db: DbClient, taskId: string): Promise<void> {
  await ensureInstallationSchema(db, taskId);
  await db.execute("UPDATE app_installation SET transfer_status='incomplete',transfer_task_id=? WHERE id=1", [taskId]);
}
export async function markTransferReady(db: DbClient): Promise<void> {
  await db.execute("UPDATE app_installation SET transfer_status='ready',transfer_task_id=NULL WHERE id=1");
}
