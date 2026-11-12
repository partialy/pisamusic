package cn.partialy.pm.sync

import cn.partialy.pm.model.SyncChange
import cn.partialy.pm.utils.loveUtil.LoveManager

internal class FavoriteSongSyncApplier(private val loveManager: LoveManager) {
    fun seed(accountId: String) = loveManager.seedSyncOutbox(accountId)

    fun apply(change: SyncChange, accountId: String) {
        val song = SyncPayloads.parseSong(change.payload, change.itemKey) ?: SyncPayloads.songFromKey(change.itemKey) ?: return
        if (song.source == "local") return
        if (change.action == SyncPayloads.ACTION_DELETE) loveManager.removeFromSync(song, accountId)
        else loveManager.upsertFromSync(song, accountId)
    }
}
