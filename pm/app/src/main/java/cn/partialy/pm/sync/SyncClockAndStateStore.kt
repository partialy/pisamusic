package cn.partialy.pm.sync

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.SyncAppliedItem
import cn.partialy.pm.model.SyncRejectedItem

internal data class SyncAccountStateRow(
    val accountId: String,
    val seeded: Boolean,
    val lastVersion: Long,
    val lastSyncAt: Long,
    val lastError: String,
    val hlcPt: Long,
    val hlcLc: Int,
    val clockOffsetMs: Long,
)

internal data class HlcTick(
    val pt: Long,
    val lc: Int,
)

internal object SyncClockAndStateStore {
    private const val HISTORY_KEEP_MIN = 1000
    private const val HISTORY_RETENTION_MS = 30L * 86400_000L

    /** 纯函数 HLC 步进：结合服务端时钟偏移保证离线操作时间戳单调不回退。 */
    fun advanceHlc(prevPt: Long, prevLc: Int, localNowMs: Long, clockOffsetMs: Long): HlcTick {
        val alignedNow = (localNowMs + clockOffsetMs).coerceAtLeast(0L)
        return if (alignedNow > prevPt) {
            HlcTick(alignedNow, 0)
        } else {
            HlcTick(prevPt, prevLc + 1)
        }
    }

    fun readState(db: SQLiteDatabase, accountId: String): SyncAccountStateRow {
        val normalized = accountId.trim()
        if (normalized.isBlank()) {
            return SyncAccountStateRow("", false, 0L, 0L, "", 0L, 0, 0L)
        }
        db.query(
            "sync_account_state",
            null,
            "account_id = ?",
            arrayOf(normalized),
            null,
            null,
            null,
            "1",
        ).use { c ->
            if (!c.moveToFirst()) return SyncAccountStateRow(normalized, false, 0L, 0L, "", 0L, 0, 0L)
            return SyncAccountStateRow(
                accountId = normalized,
                seeded = c.getInt(c.getColumnIndexOrThrow("seeded")) != 0,
                lastVersion = c.getLong(c.getColumnIndexOrThrow("last_version")),
                lastSyncAt = c.getLong(c.getColumnIndexOrThrow("last_sync_at")),
                lastError = c.getString(c.getColumnIndexOrThrow("last_error")).orEmpty(),
                hlcPt = c.getLong(c.getColumnIndexOrThrow("hlc_pt")),
                hlcLc = c.getInt(c.getColumnIndexOrThrow("hlc_lc")),
                clockOffsetMs = c.getLong(c.getColumnIndexOrThrow("clock_offset_ms")),
            )
        }
    }

    fun ensureRow(db: SQLiteDatabase, accountId: String) {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return
        db.execSQL("INSERT OR IGNORE INTO sync_account_state(account_id) VALUES (?)", arrayOf(normalized))
    }

    fun markSeeded(db: SQLiteDatabase, accountId: String) {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return
        ensureRow(db, normalized)
        db.execSQL("UPDATE sync_account_state SET seeded = 1, last_error = '' WHERE account_id = ?", arrayOf(normalized))
    }

    fun resetCursorOnly(db: SQLiteDatabase, accountId: String) {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return
        ensureRow(db, normalized)
        db.execSQL(
            "UPDATE sync_account_state SET seeded = 1, last_version = 0, last_sync_at = 0, last_error = '' WHERE account_id = ?",
            arrayOf(normalized),
        )
    }

    fun markSyncSuccess(db: SQLiteDatabase, accountId: String, version: Long, nowMs: Long = System.currentTimeMillis()) {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return
        ensureRow(db, normalized)
        db.execSQL(
            "UPDATE sync_account_state SET seeded = 1, last_version = ?, last_sync_at = ?, last_error = '' WHERE account_id = ?",
            arrayOf<Any>(version, nowMs, normalized),
        )
    }

    fun markSyncError(db: SQLiteDatabase, accountId: String, message: String) {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return
        ensureRow(db, normalized)
        db.execSQL("UPDATE sync_account_state SET last_error = ? WHERE account_id = ?", arrayOf(message, normalized))
    }

    fun updateServerClock(db: SQLiteDatabase, accountId: String, serverTimeMs: Long, localNowMs: Long = System.currentTimeMillis()) {
        val normalized = accountId.trim()
        if (normalized.isBlank() || serverTimeMs <= 0L) return
        ensureRow(db, normalized)
        val current = readState(db, normalized)
        val offset = serverTimeMs - localNowMs
        val nextPt = maxOf(current.hlcPt, serverTimeMs)
        val nextLc = if (nextPt > current.hlcPt) 0 else current.hlcLc
        db.execSQL(
            "UPDATE sync_account_state SET clock_offset_ms = ?, hlc_pt = ?, hlc_lc = ? WHERE account_id = ?",
            arrayOf<Any>(offset, nextPt, nextLc, normalized),
        )
    }

    fun nextLocalOperationClock(db: SQLiteDatabase, accountId: String, localNowMs: Long = System.currentTimeMillis()): Long {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return localNowMs
        ensureRow(db, normalized)
        val current = readState(db, normalized)
        val next = advanceHlc(current.hlcPt, current.hlcLc, localNowMs, current.clockOffsetMs)
        db.execSQL(
            "UPDATE sync_account_state SET hlc_pt = ?, hlc_lc = ? WHERE account_id = ?",
            arrayOf<Any>(next.pt, next.lc, normalized),
        )
        return next.pt
    }

    fun readBaseVersion(db: SQLiteDatabase, accountId: String, itemType: String, itemKey: String): Long {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return 0L
        db.rawQuery(
            "SELECT server_version FROM sync_entity_versions WHERE account_id = ? AND item_type = ? AND item_key = ? LIMIT 1",
            arrayOf(normalized, itemType, itemKey),
        ).use { c ->
            return if (c.moveToFirst()) c.getLong(0) else 0L
        }
    }

    fun upsertEntityVersion(
        db: SQLiteDatabase,
        accountId: String,
        itemType: String,
        itemKey: String,
        serverVersion: Long,
        deleted: Boolean,
        nowMs: Long = System.currentTimeMillis(),
    ) {
        val normalized = accountId.trim()
        if (normalized.isBlank() || serverVersion < 0L) return
        val values = ContentValues().apply {
            put("account_id", normalized)
            put("item_type", itemType)
            put("item_key", itemKey)
            put("server_version", serverVersion)
            put("deleted", if (deleted) 1 else 0)
            put("updated_at", nowMs)
        }
        db.insertWithOnConflict("sync_entity_versions", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun clearEntityVersions(db: SQLiteDatabase, accountId: String) {
        db.delete("sync_entity_versions", "account_id = ?", arrayOf(accountId.trim()))
    }

    fun appendOpHistory(
        db: SQLiteDatabase,
        accountId: String,
        opId: String,
        itemType: String,
        itemKey: String,
        action: String,
        baseVersion: Long,
        clientUpdatedAt: Long,
        status: String = "pending",
        detail: String = "",
        nowMs: Long = System.currentTimeMillis(),
    ) {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return
        val values = ContentValues().apply {
            put("account_id", normalized)
            put("op_id", opId)
            put("item_type", itemType)
            put("item_key", itemKey)
            put("action", action)
            put("base_version", baseVersion)
            put("client_updated_at", clientUpdatedAt)
            put("status", status)
            put("detail", detail)
            put("created_at", nowMs)
        }
        db.insert("sync_op_history", null, values)
    }

    fun recordPushResults(
        db: SQLiteDatabase,
        accountId: String,
        sentOpIds: Collection<String>,
        appliedItems: List<SyncAppliedItem>,
        rejectedItems: List<SyncRejectedItem>,
        actionByOpId: Map<String, String>,
        nowMs: Long = System.currentTimeMillis(),
    ) {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return
        val handled = HashSet<String>()
        for (item in appliedItems) {
            handled += item.opId
            db.execSQL(
                "UPDATE sync_op_history SET status = ?, server_version = ?, detail = ? WHERE account_id = ? AND op_id = ?",
                arrayOf<Any>("synced", item.version, if (item.noop) "noop" else "", normalized, item.opId),
            )
            val action = actionByOpId[item.opId]
            upsertEntityVersion(db, normalized, item.itemType, item.itemKey, item.version, action == SyncPayloads.ACTION_DELETE, nowMs)
        }
        for (item in rejectedItems) {
            handled += item.opId
            val status = if (item.reason == "lww_lost") "dropped_by_lww" else item.reason
            db.execSQL(
                "UPDATE sync_op_history SET status = ?, server_version = ?, detail = ? WHERE account_id = ? AND op_id = ?",
                arrayOf<Any>(status, item.serverVersion, item.reason, normalized, item.opId),
            )
        }
        for (opId in sentOpIds) {
            if (opId in handled) continue
            db.execSQL(
                "UPDATE sync_op_history SET status = 'coalesced' WHERE account_id = ? AND op_id = ? AND status = 'pending'",
                arrayOf(normalized, opId),
            )
        }
    }

    fun pruneOpHistory(db: SQLiteDatabase, accountId: String, nowMs: Long = System.currentTimeMillis()) {
        val normalized = accountId.trim()
        if (normalized.isBlank()) return
        val cutoffId = db.rawQuery(
            "SELECT id FROM sync_op_history WHERE account_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?",
            arrayOf(normalized, (HISTORY_KEEP_MIN - 1).toString()),
        ).use { c -> if (c.moveToFirst()) c.getLong(0) else null } ?: return
        db.delete(
            "sync_op_history",
            "account_id = ? AND id < ? AND created_at < ?",
            arrayOf(normalized, cutoffId.toString(), (nowMs - HISTORY_RETENTION_MS).toString()),
        )
    }
}
