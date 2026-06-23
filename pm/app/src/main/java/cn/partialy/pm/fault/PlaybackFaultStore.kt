package cn.partialy.pm.fault

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackFaultStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val helper = LocalMusicDbOpenHelper(context)

    fun insert(log: PlaybackFaultLog) {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            db.insertWithOnConflict(TABLE_LOGS, null, log.toValues(), SQLiteDatabase.CONFLICT_IGNORE)
            trimToLimit(db)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun stats(now: Long = System.currentTimeMillis()): PlaybackFaultStats {
        val db = helper.readableDatabase
        val sevenDaysAgo = now - SEVEN_DAYS_MS
        val row = db.rawQuery(
            """
            SELECT COUNT(*) AS total_count,
                   SUM(CASE WHEN occurred_at >= ? THEN 1 ELSE 0 END) AS recent_count,
                   SUM(CASE WHEN is_upload = 0 THEN 1 ELSE 0 END) AS pending_count,
                   MAX(occurred_at) AS latest_at
            FROM $TABLE_LOGS
            """.trimIndent(),
            arrayOf(sevenDaysAgo.toString()),
        ).use { cursor ->
            cursor.moveToFirst()
            PlaybackFaultStats(
                totalCount = cursor.getInt(cursor.getColumnIndexOrThrow("total_count")),
                recentSevenDaysCount = cursor.getInt(cursor.getColumnIndexOrThrow("recent_count")),
                pendingCount = cursor.getInt(cursor.getColumnIndexOrThrow("pending_count")),
                latestOccurredAt = cursor.optionalLong("latest_at"),
                lastReportedAt = null,
            )
        }
        val lastReportedAt = db.query(TABLE_STATE, arrayOf("last_reported_at"), "id = 1", null, null, null, null)
            .use { cursor -> if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null }
        return row.copy(lastReportedAt = lastReportedAt)
    }

    fun pendingLogs(): List<PlaybackFaultLog> = helper.readableDatabase.query(
        TABLE_LOGS,
        null,
        "is_upload = 0",
        null,
        null,
        null,
        "occurred_at ASC, id ASC",
        MAX_LOGS.toString(),
    ).use { cursor -> buildList { while (cursor.moveToNext()) add(cursor.toLog()) } }

    fun markUploaded(ids: List<String>, uploadedAt: Long) {
        if (ids.isEmpty()) return
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            val values = ContentValues().apply {
                put("is_upload", 1)
                put("uploaded_at", uploadedAt)
            }
            ids.chunked(100).forEach { chunk ->
                val placeholders = chunk.joinToString(",") { "?" }
                db.update(TABLE_LOGS, values, "id IN ($placeholders) AND is_upload = 0", chunk.toTypedArray())
            }
            db.execSQL(
                "INSERT OR REPLACE INTO $TABLE_STATE(id, last_reported_at) VALUES (1, ?)",
                arrayOf(uploadedAt),
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun trimToLimit(db: SQLiteDatabase) {
        val count = db.rawQuery("SELECT COUNT(*) FROM $TABLE_LOGS", null).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
        var overflow = count - MAX_LOGS
        if (overflow <= 0) return
        val uploadedIds = oldestIds(db, "is_upload = 1", overflow)
        deleteIds(db, uploadedIds)
        overflow -= uploadedIds.size
        if (overflow > 0) deleteIds(db, oldestIds(db, null, overflow))
    }

    private fun oldestIds(db: SQLiteDatabase, selection: String?, limit: Int): List<String> = db.query(
        TABLE_LOGS,
        arrayOf("id"),
        selection,
        null,
        null,
        null,
        "occurred_at ASC, id ASC",
        limit.toString(),
    ).use { cursor -> buildList { while (cursor.moveToNext()) add(cursor.getString(0)) } }

    private fun deleteIds(db: SQLiteDatabase, ids: List<String>) {
        if (ids.isEmpty()) return
        val placeholders = ids.joinToString(",") { "?" }
        db.delete(TABLE_LOGS, "id IN ($placeholders)", ids.toTypedArray())
    }

    private fun PlaybackFaultLog.toValues() = ContentValues().apply {
        put("id", id); put("scene", scene); put("failure_type", failureType); put("occurred_at", occurredAt)
        put("method_name", methodName); put("request_method", requestMethod); put("request_url", requestUrl)
        put("request_params_json", requestParamsJson); put("nonce_id", nonceId)
        if (responseCode == null) putNull("response_code") else put("response_code", responseCode)
        put("response_body", responseBody); put("resolved_url", resolvedUrl); put("error_type", errorType)
        put("error_message", errorMessage); put("stack_trace", stackTrace); put("song_source", songSource)
        put("song_id", songId); put("quality", quality); put("is_upload", if (isUpload) 1 else 0)
        if (uploadedAt == null) putNull("uploaded_at") else put("uploaded_at", uploadedAt)
    }

    private fun Cursor.toLog() = PlaybackFaultLog(
        id = getString(getColumnIndexOrThrow("id")), scene = getString(getColumnIndexOrThrow("scene")),
        failureType = getString(getColumnIndexOrThrow("failure_type")), occurredAt = getLong(getColumnIndexOrThrow("occurred_at")),
        methodName = getString(getColumnIndexOrThrow("method_name")), requestMethod = getString(getColumnIndexOrThrow("request_method")),
        requestUrl = getString(getColumnIndexOrThrow("request_url")), requestParamsJson = getString(getColumnIndexOrThrow("request_params_json")),
        nonceId = getString(getColumnIndexOrThrow("nonce_id")), responseCode = optionalInt("response_code"),
        responseBody = getString(getColumnIndexOrThrow("response_body")), resolvedUrl = getString(getColumnIndexOrThrow("resolved_url")),
        errorType = getString(getColumnIndexOrThrow("error_type")), errorMessage = getString(getColumnIndexOrThrow("error_message")),
        stackTrace = getString(getColumnIndexOrThrow("stack_trace")), songSource = getString(getColumnIndexOrThrow("song_source")),
        songId = getString(getColumnIndexOrThrow("song_id")), quality = getString(getColumnIndexOrThrow("quality")),
        isUpload = getInt(getColumnIndexOrThrow("is_upload")) == 1, uploadedAt = optionalLong("uploaded_at"),
    )

    private fun Cursor.optionalLong(column: String): Long? {
        val index = getColumnIndexOrThrow(column)
        return if (isNull(index)) null else getLong(index)
    }

    private fun Cursor.optionalInt(column: String): Int? {
        val index = getColumnIndexOrThrow(column)
        return if (isNull(index)) null else getInt(index)
    }

    companion object {
        private const val TABLE_LOGS = "playback_fault_logs"
        private const val TABLE_STATE = "playback_fault_state"
        private const val MAX_LOGS = 300
        private const val SEVEN_DAYS_MS = 7L * 24 * 60 * 60 * 1000
    }
}
