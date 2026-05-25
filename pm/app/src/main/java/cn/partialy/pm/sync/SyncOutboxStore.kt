package cn.partialy.pm.sync

import android.content.ContentValues
import android.content.Context
import cn.partialy.pm.model.SyncChangeInput
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import java.time.Instant
import java.util.UUID

class SyncOutboxStore(context: Context) {
    private val helper = LocalMusicDbOpenHelper(context.applicationContext)

    fun enqueue(itemType: String, itemKey: String, action: String, payloadJson: String = "{}") {
        if (itemType.isBlank() || itemKey.isBlank()) return
        val values = ContentValues().apply {
            put("op_id", UUID.randomUUID().toString())
            put("item_type", itemType)
            put("item_key", itemKey)
            put("action", action)
            put("payload_json", payloadJson.ifBlank { "{}" })
            put("created_at", System.currentTimeMillis())
        }
        helper.writableDatabase.insert("sync_outbox", null, values)
    }

    fun listPending(limit: Int = 200): List<PendingSyncOp> {
        helper.readableDatabase.query(
            "sync_outbox",
            null,
            null,
            null,
            null,
            null,
            "created_at ASC, id ASC",
            limit.coerceAtLeast(1).toString(),
        ).use { cursor ->
            val out = ArrayList<PendingSyncOp>(cursor.count)
            while (cursor.moveToNext()) {
                out.add(
                    PendingSyncOp(
                        id = cursor.getLong(cursor.getColumnIndexOrThrow("id")),
                        opId = cursor.getString(cursor.getColumnIndexOrThrow("op_id")).orEmpty(),
                        itemType = cursor.getString(cursor.getColumnIndexOrThrow("item_type")).orEmpty(),
                        itemKey = cursor.getString(cursor.getColumnIndexOrThrow("item_key")).orEmpty(),
                        action = cursor.getString(cursor.getColumnIndexOrThrow("action")).orEmpty(),
                        payloadJson = cursor.getString(cursor.getColumnIndexOrThrow("payload_json")).orEmpty(),
                        createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("created_at")),
                    )
                )
            }
            return out
        }
    }

    fun removeOps(opIds: Collection<String>) {
        if (opIds.isEmpty()) return
        val db = helper.writableDatabase
        db.beginTransaction()
        try {
            opIds.forEach { opId ->
                db.delete("sync_outbox", "op_id = ?", arrayOf(opId))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }
}

data class PendingSyncOp(
    val id: Long,
    val opId: String,
    val itemType: String,
    val itemKey: String,
    val action: String,
    val payloadJson: String,
    val createdAt: Long,
) {
    fun toChangeInput(payload: Any): SyncChangeInput =
        SyncChangeInput(
            opId = opId,
            itemType = itemType,
            itemKey = itemKey,
            action = action,
            payload = payload,
            clientUpdatedAt = Instant.ofEpochMilli(createdAt).toString(),
        )
}
