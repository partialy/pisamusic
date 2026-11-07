package cn.partialy.pm.listen

import java.util.UUID

/** 整列表替换保留同曲已有的协议元数据，不把客户端精简 DTO 回写成空信息。 */
internal fun replaceHostPlaylistQueue(
    previous: ListenTogetherQueueState,
    songs: List<ListenTogetherSong>,
    selected: ListenTogetherSong,
    userId: String,
    now: Long = System.currentTimeMillis(),
    newItemId: () -> String = { UUID.randomUUID().toString() },
): ListenTogetherQueueState {
    val items = songs.map { song ->
        val old = previous.items.firstOrNull {
            it.song.source.equals(song.source, ignoreCase = true) && it.song.id == song.id
        }
        if (old == null) {
            ListenTogetherQueueItem(newItemId(), song, userId, now)
        } else {
            old.copy(song = old.song.copy(
                name = song.name.ifBlank { old.song.name },
                singer = song.singer.ifBlank { old.song.singer },
                album = song.album.ifBlank { old.song.album },
                cover = song.cover.ifBlank { old.song.cover },
                duration = song.duration.takeIf { it > 0 } ?: old.song.duration,
                url = "",
                filePath = null,
            ))
        }
    }
    return ListenTogetherQueueState(
        queueVersion = previous.queueVersion + 1,
        currentItemId = items.firstOrNull {
            it.song.source.equals(selected.source, ignoreCase = true) && it.song.id == selected.id
        }?.queueItemId,
        items = items,
    )
}
