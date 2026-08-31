package cn.partialy.pm.listening

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ListeningStore @Inject constructor(@ApplicationContext context: Context) {
    private val helper = LocalMusicDbOpenHelper(context)

    fun checkpoint(accountId: String, deviceId: String, sessionId: String): ListeningCheckpoint? =
        helper.readableDatabase.query(TABLE_CHECKPOINT, null,
            "account_id = ? AND device_id = ? AND play_session_id = ?",
            arrayOf(accountId, deviceId, sessionId), null, null, null, null
        ).use { cursor -> if (cursor.moveToFirst()) cursor.toCheckpoint() else null }

    fun saveCheckpoint(value: ListeningCheckpoint) {
        helper.writableDatabase.insertWithOnConflict(TABLE_CHECKPOINT, null, value.toValues(), android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun deleteCheckpoint(accountId: String, deviceId: String, sessionId: String) {
        helper.writableDatabase.delete(TABLE_CHECKPOINT, "account_id = ? AND device_id = ? AND play_session_id = ?", arrayOf(accountId, deviceId, sessionId))
    }

    fun addPending(value: PendingListeningFragment) {
        helper.writableDatabase.insertWithOnConflict(TABLE_PENDING, null, value.toValues(), android.database.sqlite.SQLiteDatabase.CONFLICT_IGNORE)
    }

    fun pending(accountId: String, limit: Int = 200): List<PendingListeningFragment> = helper.readableDatabase.query(
        TABLE_PENDING, null, "account_id = ?", arrayOf(accountId), null, null, "created_at_ms ASC", limit.toString()
    ).use { cursor -> buildList { while (cursor.moveToNext()) add(cursor.toPending()) } }

    fun deletePending(accountId: String, eventIds: Collection<String>) {
        if (eventIds.isEmpty()) return
        val marks = eventIds.joinToString(",") { "?" }
        helper.writableDatabase.delete(TABLE_PENDING, "account_id = ? AND event_id IN ($marks)", arrayOf(accountId, *eventIds.toTypedArray()))
    }

    private fun ListeningCheckpoint.toValues() = ContentValues().apply {
        put("account_id", accountId); put("device_id", deviceId); put("play_session_id", playSessionId)
        put("source", track.source); put("song_id", track.songId); put("title", track.title); put("artist", track.artist)
        if (track.album == null) putNull("album") else put("album", track.album)
        if (track.trackDurationMs == null) putNull("track_duration_ms") else put("track_duration_ms", track.trackDurationMs)
        put("started_at_ms", startedAtMs); put("last_checkpoint_at_ms", lastCheckpointAtMs)
        put("last_monotonic_ms", lastMonotonicMs); put("active_elapsed_ms", activeElapsedMs)
    }

    private fun PendingListeningFragment.toValues() = ContentValues().apply {
        put("event_id", eventId); put("account_id", accountId); put("device_id", deviceId); put("play_session_id", fragment.playSessionId)
        put("source", fragment.source); put("song_id", fragment.songId); put("title", fragment.title); put("artist", fragment.artist)
        if (fragment.album == null) putNull("album") else put("album", fragment.album)
        if (fragment.trackDurationMs == null) putNull("track_duration_ms") else put("track_duration_ms", fragment.trackDurationMs)
        put("started_at_ms", fragment.startedAtMs); put("ended_at_ms", fragment.endedAtMs); put("active_duration_ms", fragment.activeDurationMs)
        if (fragment.terminalReason == null) putNull("terminal_reason") else put("terminal_reason", fragment.terminalReason)
        put("created_at_ms", System.currentTimeMillis())
    }

    private fun Cursor.toCheckpoint() = ListeningCheckpoint(
        accountId = getString(getColumnIndexOrThrow("account_id")), deviceId = getString(getColumnIndexOrThrow("device_id")),
        playSessionId = getString(getColumnIndexOrThrow("play_session_id")), track = ListeningTrack(
            source = getString(getColumnIndexOrThrow("source")), songId = getString(getColumnIndexOrThrow("song_id")),
            title = getString(getColumnIndexOrThrow("title")), artist = getString(getColumnIndexOrThrow("artist")),
            album = getStringOrNull("album"), trackDurationMs = getLongOrNull("track_duration_ms")),
        startedAtMs = getLong(getColumnIndexOrThrow("started_at_ms")), lastCheckpointAtMs = getLong(getColumnIndexOrThrow("last_checkpoint_at_ms")),
        lastMonotonicMs = getLong(getColumnIndexOrThrow("last_monotonic_ms")), activeElapsedMs = getLong(getColumnIndexOrThrow("active_elapsed_ms")),
    )

    private fun Cursor.toPending() = PendingListeningFragment(
        eventId = getString(getColumnIndexOrThrow("event_id")), accountId = getString(getColumnIndexOrThrow("account_id")),
        deviceId = getString(getColumnIndexOrThrow("device_id")), fragment = ListeningFragment(
            eventId = getString(getColumnIndexOrThrow("event_id")), playSessionId = getString(getColumnIndexOrThrow("play_session_id")),
            source = getString(getColumnIndexOrThrow("source")), songId = getString(getColumnIndexOrThrow("song_id")), title = getString(getColumnIndexOrThrow("title")),
            artist = getString(getColumnIndexOrThrow("artist")), album = getStringOrNull("album"), trackDurationMs = getLongOrNull("track_duration_ms"),
            startedAtMs = getLong(getColumnIndexOrThrow("started_at_ms")), endedAtMs = getLong(getColumnIndexOrThrow("ended_at_ms")),
            activeDurationMs = getLong(getColumnIndexOrThrow("active_duration_ms")), terminalReason = getStringOrNull("terminal_reason")),
    )

    private fun Cursor.getStringOrNull(name: String): String? = getColumnIndexOrThrow(name).let { if (isNull(it)) null else getString(it) }
    private fun Cursor.getLongOrNull(name: String): Long? = getColumnIndexOrThrow(name).let { if (isNull(it)) null else getLong(it) }

    private companion object { const val TABLE_CHECKPOINT = "listening_active_checkpoint"; const val TABLE_PENDING = "listening_pending_fragments" }
}
