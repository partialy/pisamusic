package cn.partialy.pm.sync

import org.junit.Assert.*
import org.junit.Test

class FavoriteSyncRulesTest {
    private fun op(id: Long, type: String = "favorite_song", key: String = "kg:1", action: String = "upsert") =
        PendingSyncOp(id, "op-$id", type, key, action, "account", "{}", id)

    @Test fun coalescingKeepsFinalIntentAndAllAcknowledgedIds() {
        val batch = coalescePendingOps(listOf(op(1), op(2, key = "kg:2"), op(3, action = "delete")))
        assertEquals(listOf("op-3", "op-2"), batch.changes.map { it.opId })
        assertEquals(setOf("op-1", "op-2", "op-3"), batch.opIds.toSet())
        // 本批抓取之后产生的操作绝不能被成功确认误删。
        assertFalse(batch.opIds.contains("op-4"))
    }

    @Test fun itemTypeIsPartOfIdentityAndBatchBoundPreservesRemainingIds() {
        val pending = (1L..201L).map { op(it, key = "kg:$it") } + op(202, type = "playlist_track")
        val batch = coalescePendingOps(pending)
        assertEquals(200, batch.changes.size)
        assertFalse(batch.opIds.contains("op-201"))
        assertFalse(batch.opIds.contains("op-202"))
        assertEquals(2, coalescePendingOps(listOf(op(1), op(2, type = "playlist_track"))).changes.size)
    }

    @Test fun favoriteTimeSurvivesPayloadAndLegacyPayloadRemainsCompatible() {
        val parsed = SyncPayloads.parseSong(mapOf("id" to "1", "source" to "kg", "favoritedAt" to 1700000000123L))!!
        assertEquals(1700000000123L, parsed.favoritedAt)
        assertNull(SyncPayloads.parseSong(mapOf("id" to "1", "source" to "kg"))!!.favoritedAt)
        assertNull(SyncPayloads.parseSong(mapOf("id" to "1", "source" to "kg", "favoritedAt" to -1))!!.favoritedAt)
    }
}
