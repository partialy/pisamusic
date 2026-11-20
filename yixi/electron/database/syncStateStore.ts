import type { DatabaseSync } from "node:sqlite";

export type SyncAccountStateRow = {
  accountId: string;
  seeded: boolean;
  lastVersion: number;
  lastSyncAt: string;
  lastError: string;
  hlcPt: number;
  hlcLc: number;
  clockOffsetMs: number;
};

export type SyncAppliedItemInput = {
  opId: string;
  itemType: string;
  itemKey: string;
  version: number;
  noop?: boolean;
};

export type SyncRejectedItemInput = {
  opId: string;
  itemType: string;
  itemKey: string;
  reason: string;
  serverVersion: number;
};

export type SyncOpHistoryRow = {
  id: number;
  account_id: string;
  op_id: string;
  item_type: string;
  item_key: string;
  action: string;
  base_version: number;
  client_updated_at: string;
  status: string;
  server_version: number | null;
  detail: string;
  created_at: number;
};

const HISTORY_KEEP_MIN = 1000;
const HISTORY_RETENTION_MS = 30 * 86_400_000;

/** 纯函数 HLC 步进：结合服务端时钟偏移保证离线操作时间戳单调不回退。 */
export function advanceHlc(prevPt: number, prevLc: number, localNowMs: number, clockOffsetMs: number) {
  const alignedNow = Math.max(0, Math.trunc(localNowMs + clockOffsetMs));
  if (alignedNow > prevPt) return { pt: alignedNow, lc: 0 };
  return { pt: prevPt, lc: prevLc + 1 };
}

export class SyncStateStore {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  readState(accountId: string): SyncAccountStateRow {
    const id = accountId.trim();
    if (!id) {
      return { accountId: "", seeded: false, lastVersion: 0, lastSyncAt: "", lastError: "", hlcPt: 0, hlcLc: 0, clockOffsetMs: 0 };
    }
    const row = this.db.prepare("SELECT * FROM sync_account_state WHERE account_id = ?").get(id) as
      | {
          seeded: number;
          last_version: number;
          last_sync_at: string;
          last_error: string;
          hlc_pt: number;
          hlc_lc: number;
          clock_offset_ms: number;
        }
      | undefined;
    if (!row) {
      return { accountId: id, seeded: false, lastVersion: 0, lastSyncAt: "", lastError: "", hlcPt: 0, hlcLc: 0, clockOffsetMs: 0 };
    }
    return {
      accountId: id,
      seeded: Number(row.seeded) !== 0,
      lastVersion: Number(row.last_version) || 0,
      lastSyncAt: row.last_sync_at || "",
      lastError: row.last_error || "",
      hlcPt: Number(row.hlc_pt) || 0,
      hlcLc: Number(row.hlc_lc) || 0,
      clockOffsetMs: Number(row.clock_offset_ms) || 0,
    };
  }

  private ensureRow(accountId: string) {
    const id = accountId.trim();
    if (!id) return;
    this.db.prepare("INSERT OR IGNORE INTO sync_account_state (account_id) VALUES (?)").run(id);
  }

  markSeeded(accountId: string) {
    const id = accountId.trim();
    if (!id) return;
    this.ensureRow(id);
    this.db.prepare("UPDATE sync_account_state SET seeded = 1, last_error = '' WHERE account_id = ?").run(id);
  }

  resetCursorOnly(accountId: string) {
    const id = accountId.trim();
    if (!id) return;
    this.ensureRow(id);
    this.db
      .prepare("UPDATE sync_account_state SET seeded = 1, last_version = 0, last_sync_at = '', last_error = '' WHERE account_id = ?")
      .run(id);
  }

  markSyncSuccess(accountId: string, version: number, lastSyncAt = new Date().toISOString()) {
    const id = accountId.trim();
    if (!id) return;
    this.ensureRow(id);
    this.db
      .prepare("UPDATE sync_account_state SET seeded = 1, last_version = ?, last_sync_at = ?, last_error = '' WHERE account_id = ?")
      .run(version, lastSyncAt, id);
  }

  markSyncError(accountId: string, message: string) {
    const id = accountId.trim();
    if (!id) return;
    this.ensureRow(id);
    this.db.prepare("UPDATE sync_account_state SET last_error = ? WHERE account_id = ?").run(message, id);
  }

  updateServerClock(accountId: string, serverTimeMs: number, localNowMs = Date.now()) {
    const id = accountId.trim();
    if (!id || !Number.isFinite(serverTimeMs) || serverTimeMs <= 0) return;
    this.ensureRow(id);
    const current = this.readState(id);
    const offset = Math.trunc(serverTimeMs - localNowMs);
    const nextPt = Math.max(current.hlcPt, Math.trunc(serverTimeMs));
    const nextLc = nextPt > current.hlcPt ? 0 : current.hlcLc;
    this.db
      .prepare("UPDATE sync_account_state SET clock_offset_ms = ?, hlc_pt = ?, hlc_lc = ? WHERE account_id = ?")
      .run(offset, nextPt, nextLc, id);
  }

  nextLocalOperationClock(accountId: string, localNowMs = Date.now()): string {
    const id = accountId.trim();
    if (!id) return new Date(localNowMs).toISOString();
    this.ensureRow(id);
    const current = this.readState(id);
    const next = advanceHlc(current.hlcPt, current.hlcLc, localNowMs, current.clockOffsetMs);
    this.db
      .prepare("UPDATE sync_account_state SET hlc_pt = ?, hlc_lc = ? WHERE account_id = ?")
      .run(next.pt, next.lc, id);
    return new Date(next.pt).toISOString();
  }

  readBaseVersion(accountId: string, itemType: string, itemKey: string): number {
    const id = accountId.trim();
    if (!id) return 0;
    const row = this.db
      .prepare("SELECT server_version FROM sync_entity_versions WHERE account_id = ? AND item_type = ? AND item_key = ?")
      .get(id, itemType, itemKey) as { server_version: number } | undefined;
    return Number(row?.server_version) || 0;
  }

  upsertEntityVersion(
    accountId: string,
    itemType: string,
    itemKey: string,
    serverVersion: number,
    deleted: boolean,
    nowMs = Date.now(),
  ) {
    const id = accountId.trim();
    if (!id || serverVersion < 0) return;
    this.db
      .prepare(`
        INSERT INTO sync_entity_versions (account_id, item_type, item_key, server_version, deleted, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(account_id, item_type, item_key)
        DO UPDATE SET server_version = excluded.server_version, deleted = excluded.deleted, updated_at = excluded.updated_at
      `)
      .run(id, itemType, itemKey, serverVersion, deleted ? 1 : 0, nowMs);
  }

  clearEntityVersions(accountId: string) {
    this.db.prepare("DELETE FROM sync_entity_versions WHERE account_id = ?").run(accountId.trim());
  }

  appendOpHistory(params: {
    accountId: string;
    opId: string;
    itemType: string;
    itemKey: string;
    action: string;
    baseVersion: number;
    clientUpdatedAt: string;
    status?: string;
    detail?: string;
    createdAt?: number;
  }) {
    const id = params.accountId.trim();
    if (!id) return;
    this.db
      .prepare(`
        INSERT INTO sync_op_history (
          account_id, op_id, item_type, item_key, action, base_version,
          client_updated_at, status, server_version, detail, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      `)
      .run(
        id,
        params.opId,
        params.itemType,
        params.itemKey,
        params.action,
        params.baseVersion,
        params.clientUpdatedAt,
        params.status ?? "pending",
        params.detail ?? "",
        params.createdAt ?? Date.now(),
      );
  }

  recordPushResults(
    accountId: string,
    sentOpIds: string[],
    appliedItems: SyncAppliedItemInput[],
    rejectedItems: SyncRejectedItemInput[],
    actionByOpId: Map<string, string>,
    nowMs = Date.now(),
  ) {
    const id = accountId.trim();
    if (!id) return;
    const handled = new Set<string>();
    const updateStmt = this.db.prepare(
      "UPDATE sync_op_history SET status = ?, server_version = ?, detail = ? WHERE account_id = ? AND op_id = ?",
    );
    for (const item of appliedItems) {
      handled.add(item.opId);
      updateStmt.run("synced", item.version, item.noop ? "noop" : "", id, item.opId);
      const action = actionByOpId.get(item.opId);
      this.upsertEntityVersion(id, item.itemType, item.itemKey, item.version, action === "delete", nowMs);
    }
    for (const item of rejectedItems) {
      handled.add(item.opId);
      const status = item.reason === "lww_lost" ? "dropped_by_lww" : item.reason;
      updateStmt.run(status, item.serverVersion, item.reason, id, item.opId);
    }
    const coalesceStmt = this.db.prepare(
      "UPDATE sync_op_history SET status = 'coalesced' WHERE account_id = ? AND op_id = ? AND status = 'pending'",
    );
    for (const opId of sentOpIds) {
      if (!handled.has(opId)) coalesceStmt.run(id, opId);
    }
  }

  markOpHistoryCoalesced(accountId: string, itemType: string, itemKey: string) {
    const id = accountId.trim();
    if (!id) return;
    this.db
      .prepare(
        "UPDATE sync_op_history SET status = 'coalesced' WHERE account_id = ? AND item_type = ? AND item_key = ? AND status = 'pending'",
      )
      .run(id, itemType, itemKey);
  }

  listOpHistory(accountId: string, limit = 100): SyncOpHistoryRow[] {
    return this.db
      .prepare("SELECT * FROM sync_op_history WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
      .all(accountId.trim(), Math.max(1, limit)) as SyncOpHistoryRow[];
  }

  pruneOpHistory(accountId: string, nowMs = Date.now()) {
    const id = accountId.trim();
    if (!id) return;
    const cutoff = this.db
      .prepare("SELECT id FROM sync_op_history WHERE account_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?")
      .get(id, HISTORY_KEEP_MIN - 1) as { id: number } | undefined;
    if (!cutoff) return;
    this.db
      .prepare("DELETE FROM sync_op_history WHERE account_id = ? AND id < ? AND created_at < ?")
      .run(id, cutoff.id, nowMs - HISTORY_RETENTION_MS);
  }
}
