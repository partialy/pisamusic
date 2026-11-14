package cn.partialy.pm.sync

import cn.partialy.pm.model.*
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager

internal class PlaylistSyncApplier(
    private val playlistCollectionManager: PlaylistCollectionManager,
    private val outbox: SyncOutboxStore,
) {
    fun seed(accountId: String) = playlistCollectionManager.withDataLock {
        if (outbox.accountSnapshot() != accountId) return@withDataLock
        playlistCollectionManager.getAllPlaylists().forEach { playlist ->
            if (playlist.type == CollectedPlaylistType.LOCAL) {
                outbox.enqueue(
                    itemType = SyncPayloads.TYPE_USER_PLAYLIST,
                    itemKey = SyncPayloads.playlistKey(playlist),
                    action = SyncPayloads.ACTION_UPSERT,
                    payloadJson = SyncPayloads.playlistPayload(playlist),
                )
                playlistCollectionManager.getLocalPlaylistSongs(playlist.id)
                    .forEach track@ { song ->
                        if (outbox.hasPending(accountId, SyncPayloads.TYPE_PLAYLIST_TRACK, SyncPayloads.playlistTrackKey(playlist.id, song))) return@track
                        outbox.enqueue(
                            itemType = SyncPayloads.TYPE_PLAYLIST_TRACK,
                            itemKey = SyncPayloads.playlistTrackKey(playlist.id, song),
                            action = SyncPayloads.ACTION_UPSERT,
                            payloadJson = SyncPayloads.songPayload(song),
                        )
                    }
            } else {
                outbox.enqueue(
                    itemType = SyncPayloads.TYPE_FAVORITE_PLAYLIST,
                    itemKey = SyncPayloads.playlistKey(playlist),
                    action = SyncPayloads.ACTION_UPSERT,
                    payloadJson = SyncPayloads.playlistPayload(playlist),
                )
            }
        }
    }

    fun localItems(): List<Pair<String, String>> = buildList {
        playlistCollectionManager.getAllPlaylists().forEach { playlist ->
            val type = if (playlist.type == CollectedPlaylistType.LOCAL) SyncPayloads.TYPE_USER_PLAYLIST else SyncPayloads.TYPE_FAVORITE_PLAYLIST
            add(type to SyncPayloads.playlistKey(playlist))
            if (playlist.type == CollectedPlaylistType.LOCAL) playlistCollectionManager.getLocalPlaylistSongs(playlist.id)
                .forEach { add(SyncPayloads.TYPE_PLAYLIST_TRACK to SyncPayloads.playlistTrackKey(playlist.id, it)) }
        }
    }

    fun apply(change: SyncChange, accountId: String) {
        playlistCollectionManager.withSyncGuard(accountId, change.itemType, change.itemKey) {
            when (change.itemType) {
                SyncPayloads.TYPE_FAVORITE_PLAYLIST -> applyPlaylist(change.itemKey, change.action, change.payload, true)
                SyncPayloads.TYPE_USER_PLAYLIST -> applyPlaylist(change.itemKey, change.action, change.payload, false)
                SyncPayloads.TYPE_PLAYLIST_TRACK -> applyPlaylistTrack(change.itemKey, change.action, change.payload, change.version)
            }
        }
    }

    fun acknowledgeOwnVersion(change: SyncChange, accountId: String) {
        if (change.itemType != SyncPayloads.TYPE_PLAYLIST_TRACK || change.action != SyncPayloads.ACTION_UPSERT) return
        val (playlistId,song) = SyncPayloads.playlistTrackFromKey(change.itemKey) ?: return
        playlistCollectionManager.withSyncGuard(accountId,change.itemType,change.itemKey) {
            playlistCollectionManager.acknowledgeTrackVersion(playlistId,song,change.version)
        }
    }

    fun reconcile(remote: Set<Pair<String, String>>, initial: List<Pair<String, String>>, accountId: String) {
        // 先曲目后父歌单；有 pending 曲目的父歌单必须保留。
        initial.sortedBy { if (it.first == SyncPayloads.TYPE_PLAYLIST_TRACK) 0 else 1 }.forEach { (type, key) ->
            if ((type to key) !in remote) apply(SyncChange(0, "", "", type, key, SyncPayloads.ACTION_DELETE, null, serverUpdatedAt = 0), accountId)
        }
    }
    private fun applyPlaylist(itemKey: String, action: String, payload: Any?, favorite: Boolean) {
        val playlist = SyncPayloads.parsePlaylist(payload, itemKey) ?: SyncPayloads.playlistFromKey(itemKey) ?: return
        if (action == SyncPayloads.ACTION_DELETE) {
            playlistCollectionManager.removePlaylistFromSync(playlist, favorite)
        } else {
            playlistCollectionManager.upsertPlaylistFromSync(clearLocalFileCover(playlist), favorite)
        }
    }

    private fun applyPlaylistTrack(itemKey: String, action: String, payload: Any?, version: Long) {
        val keyParts = SyncPayloads.playlistTrackFromKey(itemKey) ?: return
        val song = SyncPayloads.parseSong(payload, itemKey.substringAfter("|", "")) ?: keyParts.second
        playlistCollectionManager.applyTrackFromSync(keyParts.first, song,
            action == SyncPayloads.ACTION_DELETE, SyncPayloads.sortOrder(payload), version)
    }

    private fun clearLocalFileCover(playlist: CanonicalPlaylist): CanonicalPlaylist {
        if (playlist.source != "local") return playlist
        if (!SyncPayloads.isLocalOnlyCover(playlist.cover)) return playlist
        return playlist.copy(cover = "")
    }

}
