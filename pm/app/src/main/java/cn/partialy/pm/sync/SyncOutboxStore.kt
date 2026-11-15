package cn.partialy.pm.sync

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.SyncChangeInput
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import java.time.Instant
import java.util.UUID

class SyncOutboxStore(context: Context) {
    private val helperContext: Context = context.applicationContext
    private val helper = LocalMusicDbOpenHelper.shared(helperContext)

    fun enqueue(itemType: String, itemKey: String, action: String, payloadJson: String = "{}") {
        if (itemType.isBlank() || itemKey.isBlank()) return
        val db=helper.writableDatabase
        val account=accountSnapshot()
        // 此公开入口用于 seed：沿用已知文档时钟，不能因启动/重新 seed 伪造新编辑。
        val clock=if(itemType==SyncPayloads.TYPE_USER_PLAYLIST) db.rawQuery(
            "SELECT COALESCE(e.document_clock,p.updated_at) FROM local_playlists p LEFT JOIN playlist_cover_edits e ON e.account_id=p.owner_account_id AND e.playlist_id=p.id WHERE p.owner_account_id=? AND p.id=?",
            arrayOf(account,itemKey.substringAfter(":"))
        ).use { if(it.moveToFirst()) it.getLong(0) else System.currentTimeMillis() } else System.currentTimeMillis()
        enqueueInTransaction(db, account, itemType, itemKey, action, payloadJson,clock,false)
    }

    /** 调用方传入同一事务连接，账户在整批操作开始时只取一次快照。 */
    internal fun enqueueInTransaction(
        db: SQLiteDatabase, accountId: String, itemType: String, itemKey: String,
        action: String, payloadJson: String = "{}", createdAt: Long = System.currentTimeMillis(), recordDocumentEdit: Boolean = true,
    ) {
        require(itemType.isNotBlank() && itemKey.isNotBlank())
        val values = ContentValues().apply {
            put("op_id", UUID.randomUUID().toString())
            put("item_type", itemType)
            put("item_key", itemKey)
            put("action", action)
            put("account_id", accountId.trim())
            put("payload_json", payloadJson.ifBlank { "{}" })
            put("created_at", createdAt)
        }
        db.insertOrThrow("sync_outbox", null, values)
        if (recordDocumentEdit && itemType == SyncPayloads.TYPE_USER_PLAYLIST && action == SyncPayloads.ACTION_UPSERT)
            cn.partialy.pm.playlistcover.PlaylistCoverStore.recordLocalEdit(db,accountId,itemKey.substringAfter(":"),createdAt)
    }

    internal fun accountSnapshot(): String = currentAccountId()

    fun hasPending(accountId: String, itemType: String, itemKey: String): Boolean {
        helper.readableDatabase.query(
            "sync_outbox", arrayOf("id"), "account_id = ? AND item_type = ? AND item_key = ?",
            arrayOf(accountId.trim(), itemType, itemKey), null, null, null, "1",
        ).use { return it.moveToFirst() }
    }

    fun listPending(accountId: String, limit: Int = 200): List<PendingSyncOp> {
        val normalizedAccountId = accountId.trim()
        if (normalizedAccountId.isBlank()) return emptyList()
        helper.readableDatabase.query(
            "sync_outbox",
            null,
            "account_id = ?",
            arrayOf(normalizedAccountId),
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
                        accountId = cursor.getString(cursor.getColumnIndexOrThrow("account_id")).orEmpty(),
                        payloadJson = cursor.getString(cursor.getColumnIndexOrThrow("payload_json")).orEmpty(),
                        createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("created_at")),
                    )
                )
            }
            return out
        }
    }

    data class PendingBatch(val changes: List<PendingSyncOp>, val opIds: List<String>)

    /** 只删除本次发送快照内的 ID；发送期间追加的同 key 操作留待下一批。 */
    fun coalescedPending(accountId: String): PendingBatch {
        return coalescePendingOps(listPending(accountId, Int.MAX_VALUE))
    }

    fun hasPendingPlaylist(accountId: String, playlistId: String): Boolean =
        listPending(accountId, Int.MAX_VALUE).any {
            (it.itemType == SyncPayloads.TYPE_USER_PLAYLIST && it.itemKey == "local:$playlistId") ||
                (it.itemType == SyncPayloads.TYPE_PLAYLIST_TRACK && it.itemKey.startsWith("$playlistId|"))
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

    fun clearAccount(accountId: String) {
        helper.writableDatabase.delete("sync_outbox", "account_id=?", arrayOf(accountId))
    }

    private fun currentAccountId(): String =
        AccountSessionStore.read(helperContext).user.id.trim()
}

data class PendingSyncOp(
    val id: Long,
    val opId: String,
    val itemType: String,
    val itemKey: String,
    val action: String,
    val accountId: String,
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

internal fun coalescePendingOps(pending: List<PendingSyncOp>): SyncOutboxStore.PendingBatch {
    val groups = pending.groupBy { it.itemType to it.itemKey }.values.take(200)
    return SyncOutboxStore.PendingBatch(groups.map { it.last() }, groups.flatMap { group -> group.map { it.opId } })
}
