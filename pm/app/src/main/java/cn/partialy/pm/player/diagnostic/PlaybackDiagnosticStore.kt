package cn.partialy.pm.player.diagnostic

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackDiagnosticStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val helper = LocalMusicDbOpenHelper(context)

    internal fun insert(row: PlaybackDiagnosticRow) {
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            db.insertOrThrow(TABLE, null, row.toValues())
            trimToLimit(db)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun getEventsCount(): Int {
        val db = helper.readableDatabase
        return db.rawQuery("SELECT COUNT(*) FROM $TABLE", null).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    fun queryRecentEvents(limit: Int? = null): List<PlaybackDiagnosticRow> {
        val db = helper.readableDatabase
        val limitStr = limit?.takeIf { it > 0 }?.toString()
        return db.query(
            TABLE,
            null,
            null,
            null,
            null,
            null,
            "occurred_at DESC, elapsed_realtime DESC, id DESC",
            limitStr,
        ).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(cursor.toRow())
                }
            }
        }
    }

    fun exportToJsonString(rows: List<PlaybackDiagnosticRow>, requestedLimit: Int?): String {
        val root = JSONObject()
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.CHINA)
        val now = System.currentTimeMillis()
        root.put("app", "PisaMusic Android")
        root.put("exportedAtEpochMs", now)
        root.put("exportedAt", sdf.format(Date(now)))
        root.put("requestedLimit", requestedLimit?.toString() ?: "all")
        root.put("actualCount", rows.size)

        val eventsArray = JSONArray()
        for (row in rows) {
            val item = JSONObject()
            item.put("id", row.id)
            item.put("sessionId", row.sessionId)
            item.put("occurredAt", row.occurredAt)
            item.put("occurredAtFormatted", sdf.format(Date(row.occurredAt)))
            item.put("elapsedRealtimeMs", row.elapsedRealtime)
            item.put("eventType", row.event.eventType.name.lowercase(Locale.ROOT))
            item.put("action", row.event.action)
            item.put("reason", row.event.reason)
            item.put("controlSource", row.event.controlSource.name.lowercase(Locale.ROOT))
            item.put("controllerPackage", row.event.controllerPackage)

            val songObj = JSONObject()
            songObj.put("source", row.event.snapshot.songSource)
            songObj.put("id", row.event.snapshot.songId)
            item.put("song", songObj)

            val playerObj = JSONObject()
            playerObj.put("playWhenReady", row.event.snapshot.playWhenReady)
            playerObj.put("isPlaying", row.event.snapshot.isPlaying)
            playerObj.put("playbackState", row.event.snapshot.playbackState)
            playerObj.put("playbackStateName", Media3ReasonNames.playbackState(row.event.snapshot.playbackState))
            playerObj.put("suppressionReason", row.event.snapshot.suppressionReason)
            playerObj.put("suppressionReasonName", Media3ReasonNames.suppression(row.event.snapshot.suppressionReason))
            playerObj.put("positionMs", row.event.snapshot.positionMs)
            item.put("playerState", playerObj)

            val deviceObj = JSONObject()
            deviceObj.put("coexistenceMode", row.coexistenceMode)
            deviceObj.put("screenInteractive", row.screenInteractive)
            val deviceTypesArray = runCatching { JSONArray(row.outputDeviceTypesJson) }.getOrDefault(JSONArray())
            deviceObj.put("outputDeviceTypes", deviceTypesArray)
            item.put("deviceState", deviceObj)

            val detailsObj = runCatching { JSONObject(row.detailsJson) }.getOrDefault(JSONObject())
            item.put("details", detailsObj)

            eventsArray.put(item)
        }
        root.put("events", eventsArray)
        return root.toString(2)
    }

    private fun Cursor.toRow(): PlaybackDiagnosticRow {
        val id = getString(getColumnIndexOrThrow("id"))
        val sessionId = getString(getColumnIndexOrThrow("session_id"))
        val occurredAt = getLong(getColumnIndexOrThrow("occurred_at"))
        val elapsedRealtime = getLong(getColumnIndexOrThrow("elapsed_realtime"))
        val eventTypeName = getString(getColumnIndexOrThrow("event_type"))
        val action = getString(getColumnIndexOrThrow("action"))
        val reason = getString(getColumnIndexOrThrow("reason"))
        val controlSourceName = getString(getColumnIndexOrThrow("control_source"))
        val controllerPackage = getString(getColumnIndexOrThrow("controller_package"))
        val songSource = getString(getColumnIndexOrThrow("song_source"))
        val songId = getString(getColumnIndexOrThrow("song_id"))
        val playWhenReady = getInt(getColumnIndexOrThrow("play_when_ready")) == 1
        val isPlaying = getInt(getColumnIndexOrThrow("is_playing")) == 1
        val playbackState = getInt(getColumnIndexOrThrow("playback_state"))
        val suppressionReason = getInt(getColumnIndexOrThrow("suppression_reason"))
        val positionMs = getLong(getColumnIndexOrThrow("position_ms"))
        val coexistenceMode = getString(getColumnIndexOrThrow("coexistence_mode"))
        val screenInteractive = getInt(getColumnIndexOrThrow("screen_interactive")) == 1
        val outputDeviceTypesJson = getString(getColumnIndexOrThrow("output_device_types_json"))
        val detailsJson = getString(getColumnIndexOrThrow("details_json"))

        val eventType = runCatching {
            PlaybackDiagnosticEventType.valueOf(eventTypeName.uppercase(Locale.ROOT))
        }.getOrDefault(PlaybackDiagnosticEventType.CONTROL_REQUEST)

        val controlSource = runCatching {
            PlaybackControlSource.valueOf(controlSourceName.uppercase(Locale.ROOT))
        }.getOrDefault(PlaybackControlSource.UNKNOWN)

        return PlaybackDiagnosticRow(
            id = id,
            sessionId = sessionId,
            occurredAt = occurredAt,
            elapsedRealtime = elapsedRealtime,
            event = PlaybackDiagnosticEvent(
                eventType = eventType,
                action = action,
                reason = reason,
                controlSource = controlSource,
                controllerPackage = controllerPackage,
                snapshot = PlaybackPlayerSnapshot(
                    songSource = songSource,
                    songId = songId,
                    playWhenReady = playWhenReady,
                    isPlaying = isPlaying,
                    playbackState = playbackState,
                    suppressionReason = suppressionReason,
                    positionMs = positionMs,
                ),
            ),
            coexistenceMode = coexistenceMode,
            screenInteractive = screenInteractive,
            outputDeviceTypesJson = outputDeviceTypesJson,
            detailsJson = detailsJson,
        )
    }

    private fun trimToLimit(db: SQLiteDatabase) {
        val count = db.rawQuery("SELECT COUNT(*) FROM $TABLE", null).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
        val overflow = count - MAX_EVENTS
        if (overflow <= 0) return

        val staleIds = db.query(
            TABLE,
            arrayOf("id"),
            null,
            null,
            null,
            null,
            "occurred_at ASC, elapsed_realtime ASC, id ASC",
            overflow.toString(),
        ).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(cursor.getString(0))
                }
            }
        }
        if (staleIds.isEmpty()) return
        db.delete(TABLE, "id IN (${staleIds.joinToString(",") { "?" }})", staleIds.toTypedArray())
    }

    private fun PlaybackDiagnosticRow.toValues() = ContentValues().apply {
        put("id", id)
        put("session_id", sessionId)
        put("occurred_at", occurredAt)
        put("elapsed_realtime", elapsedRealtime)
        put("event_type", event.eventType.name.lowercase(Locale.ROOT))
        put("action", event.action)
        put("reason", event.reason)
        put("control_source", event.controlSource.name.lowercase(Locale.ROOT))
        put("controller_package", event.controllerPackage)
        put("song_source", event.snapshot.songSource)
        put("song_id", event.snapshot.songId)
        put("play_when_ready", if (event.snapshot.playWhenReady) 1 else 0)
        put("is_playing", if (event.snapshot.isPlaying) 1 else 0)
        put("playback_state", event.snapshot.playbackState)
        put("suppression_reason", event.snapshot.suppressionReason)
        put("position_ms", event.snapshot.positionMs)
        put("coexistence_mode", coexistenceMode)
        put("screen_interactive", if (screenInteractive) 1 else 0)
        put("output_device_types_json", outputDeviceTypesJson)
        put("details_json", detailsJson)
    }

    private companion object {
        const val TABLE = "playback_diagnostic_events"
        const val MAX_EVENTS = 300
    }
}
