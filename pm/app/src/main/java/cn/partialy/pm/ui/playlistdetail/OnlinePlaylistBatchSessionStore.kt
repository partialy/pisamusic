package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo
import java.util.UUID

/** 仅用于首屏加速；进程回收后仍通过歌单 ID 重新加载。 */
object OnlinePlaylistBatchSessionStore {
    private data class Entry(val songs: List<SongInfo>, val createdAt: Long)
    private val entries = linkedMapOf<String, Entry>()

    @Synchronized
    fun put(songs: List<SongInfo>): String {
        val now = System.currentTimeMillis()
        entries.entries.removeAll { now - it.value.createdAt > 10 * 60_000L }
        while (entries.size >= 4) entries.remove(entries.keys.first())
        return UUID.randomUUID().toString().also { entries[it] = Entry(songs.toList(), now) }
    }

    @Synchronized
    fun get(token: String?): List<SongInfo> = entries[token]?.takeIf {
        System.currentTimeMillis() - it.createdAt <= 10 * 60_000L
    }?.songs.orEmpty()
}
