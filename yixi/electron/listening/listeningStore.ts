import type { DatabaseSync } from "node:sqlite";
import type { ListeningFragment, ListeningSummary, ListeningTrackSnapshot } from "../../src/types/listening";
import type {
  ListeningActiveCheckpoint,
  ListeningActiveCheckpointRow,
  ListeningPendingFragmentRow,
  ListeningSummaryCacheRow,
} from "../database/types";

export class ListeningStore {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  saveActiveCheckpoint(checkpoint: ListeningActiveCheckpoint): void {
    const stmt = this.db.prepare(`
      INSERT INTO listening_active_checkpoint (
        account_id, device_id, play_session_id, track_json, started_at_ms, active_duration_ms, checkpointed_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        device_id = excluded.device_id,
        play_session_id = excluded.play_session_id,
        track_json = excluded.track_json,
        started_at_ms = excluded.started_at_ms,
        active_duration_ms = excluded.active_duration_ms,
        checkpointed_at_ms = excluded.checkpointed_at_ms
    `);
    stmt.run(
      checkpoint.accountId,
      checkpoint.deviceId,
      checkpoint.playSessionId,
      JSON.stringify(checkpoint.track),
      checkpoint.startedAtMs,
      checkpoint.activeDurationMs,
      checkpoint.checkpointedAtMs
    );
  }

  readActiveCheckpoint(accountId: string): ListeningActiveCheckpoint | null {
    if (!accountId) return null;
    const row = this.db
      .prepare(`SELECT * FROM listening_active_checkpoint WHERE account_id = ?`)
      .get(accountId) as ListeningActiveCheckpointRow | undefined;
    if (!row) return null;

    try {
      const track = JSON.parse(row.track_json) as ListeningTrackSnapshot;
      return {
        accountId: row.account_id,
        deviceId: row.device_id,
        playSessionId: row.play_session_id,
        track,
        startedAtMs: Number(row.started_at_ms),
        activeDurationMs: Number(row.active_duration_ms),
        checkpointedAtMs: Number(row.checkpointed_at_ms),
      };
    } catch {
      return null;
    }
  }

  clearActiveCheckpoint(accountId: string): void {
    if (!accountId) return;
    this.db.prepare(`DELETE FROM listening_active_checkpoint WHERE account_id = ?`).run(accountId);
  }

  insertPendingFragment(accountId: string, deviceId: string, fragment: ListeningFragment): void {
    const stmt = this.db.prepare(`
      INSERT INTO listening_pending_fragments (
        event_id, account_id, device_id, fragment_json, upload_state, reject_reason, created_at_ms
      ) VALUES (?, ?, ?, ?, 'pending', '', ?)
      ON CONFLICT(event_id) DO NOTHING
    `);
    stmt.run(
      fragment.eventId,
      accountId,
      deviceId,
      JSON.stringify(fragment),
      Date.now()
    );
  }

  listPendingFragments(accountId: string, deviceId: string, limit = 200): ListeningFragment[] {
    if (!accountId || !deviceId) return [];
    const normalizedLimit = Math.max(1, Math.min(limit, 200));
    const rows = this.db
      .prepare(`
        SELECT * FROM listening_pending_fragments
        WHERE account_id = ? AND device_id = ? AND upload_state = 'pending'
        ORDER BY created_at_ms ASC
        LIMIT ?
      `)
      .all(accountId, deviceId, normalizedLimit) as ListeningPendingFragmentRow[];

    const results: ListeningFragment[] = [];
    for (const row of rows) {
      try {
        const frag = JSON.parse(row.fragment_json) as ListeningFragment;
        if (frag && frag.eventId) {
          results.push(frag);
        }
      } catch {
        // Skip corrupt row
      }
    }
    return results;
  }

  ackFragments(accountId: string, deviceId: string, eventIds: string[]): void {
    if (!accountId || !deviceId || eventIds.length === 0) return;
    const stmt = this.db.prepare(`
      DELETE FROM listening_pending_fragments
      WHERE account_id = ? AND device_id = ? AND event_id = ?
    `);
    for (const id of eventIds) {
      if (typeof id === "string" && id.trim()) {
        stmt.run(accountId, deviceId, id.trim());
      }
    }
  }

  rejectFragments(
    accountId: string,
    deviceId: string,
    rejections: Array<{ eventId: string; reason: string }>
  ): void {
    if (!accountId || !deviceId || rejections.length === 0) return;
    const stmt = this.db.prepare(`
      UPDATE listening_pending_fragments
      SET upload_state = 'rejected', reject_reason = ?
      WHERE account_id = ? AND device_id = ? AND event_id = ?
    `);
    for (const r of rejections) {
      if (r && typeof r.eventId === "string" && r.eventId.trim()) {
        stmt.run(r.reason || "rejected", accountId, deviceId, r.eventId.trim());
      }
    }
  }

  readSummaryCache(accountId: string): ListeningSummary | null {
    if (!accountId) return null;
    const row = this.db
      .prepare(`SELECT summary_json FROM listening_summary_cache WHERE account_id = ?`)
      .get(accountId) as ListeningSummaryCacheRow | undefined;
    if (!row) return null;

    try {
      return JSON.parse(row.summary_json) as ListeningSummary;
    } catch {
      return null;
    }
  }

  saveSummaryCache(accountId: string, summary: ListeningSummary): void {
    if (!accountId || !summary) return;
    const stmt = this.db.prepare(`
      INSERT INTO listening_summary_cache (account_id, summary_json, updated_at_ms)
      VALUES (?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        summary_json = excluded.summary_json,
        updated_at_ms = excluded.updated_at_ms
    `);
    stmt.run(accountId, JSON.stringify(summary), Date.now());
  }
}
