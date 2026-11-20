package cn.partialy.pm.sync

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase

/**
 * V18：将同步水位、HLC 时钟偏移、实体已知版本及本地操作日志迁入 SQLite，与业务表同库同事务提交。
 */
internal object SyncStateSchema {
    fun prepare(db: SQLiteDatabase, context: Context) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS sync_account_state (
                account_id TEXT PRIMARY KEY,
                seeded INTEGER NOT NULL DEFAULT 0,
                last_version INTEGER NOT NULL DEFAULT 0,
                last_sync_at INTEGER NOT NULL DEFAULT 0,
                last_error TEXT NOT NULL DEFAULT '',
                hlc_pt INTEGER NOT NULL DEFAULT 0,
                hlc_lc INTEGER NOT NULL DEFAULT 0,
                clock_offset_ms INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS sync_entity_versions (
                account_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                item_key TEXT NOT NULL,
                server_version INTEGER NOT NULL DEFAULT 0,
                deleted INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (account_id, item_type, item_key)
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS sync_op_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id TEXT NOT NULL,
                op_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                item_key TEXT NOT NULL,
                action TEXT NOT NULL,
                base_version INTEGER NOT NULL DEFAULT 0,
                client_updated_at INTEGER NOT NULL,
                status TEXT NOT NULL,
                server_version INTEGER,
                detail TEXT NOT NULL DEFAULT '',
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_op_history_account ON sync_op_history(account_id, created_at DESC, id DESC)")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_sync_op_history_op_id ON sync_op_history(op_id)")

        if (!hasColumn(db, "sync_outbox", "base_version")) {
            db.execSQL("ALTER TABLE sync_outbox ADD COLUMN base_version INTEGER NOT NULL DEFAULT 0")
        }

        migrateLegacyPrefs(db, context)
    }

    private fun migrateLegacyPrefs(db: SQLiteDatabase, context: Context) {
        val sp = context.getSharedPreferences("pm_sync_prefs", Context.MODE_PRIVATE)
        val userId = sp.getString("user_id", "").orEmpty().trim()
        if (userId.isBlank()) return
        val values = ContentValues().apply {
            put("account_id", userId)
            put("seeded", 1)
            put("last_version", sp.getLong("last_version", 0L))
            put("last_sync_at", sp.getLong("last_sync_at", 0L))
            put("last_error", sp.getString("last_error", "").orEmpty())
        }
        db.insertWithOnConflict("sync_account_state", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    private fun hasColumn(db: SQLiteDatabase, table: String, column: String): Boolean {
        db.rawQuery("PRAGMA table_info($table)", emptyArray()).use { cursor ->
            val nameIdx = cursor.getColumnIndexOrThrow("name")
            while (cursor.moveToNext()) {
                if (cursor.getString(nameIdx) == column) return true
            }
        }
        return false
    }
}
