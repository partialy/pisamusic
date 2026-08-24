package cn.partialy.pm.player

import cn.partialy.pm.model.SongInfo

/** 播放列表和插播队列共用的歌曲唯一身份。 */
internal fun songIdentityKey(song: SongInfo): String = "${song.type}_${song.id}"

internal fun <T, K> enqueueUniqueBy(
    items: List<T>,
    item: T,
    keyOf: (T) -> K,
): List<T> {
    val itemKey = keyOf(item)
    return if (items.any { keyOf(it) == itemKey }) items else items + item
}

internal data class PlayNextPlacement(
    val songs: List<SongInfo>,
    val previousIndex: Int?,
    val targetIndex: Int,
)

internal data class NormalizedPlaylist(
    val songs: List<SongInfo>,
    val currentIndex: Int,
)

/** 清理旧状态中的重复歌曲，并把当前索引映射回同一首歌曲。 */
internal fun normalizePlaylist(
    songs: List<SongInfo>,
    currentIndex: Int,
    keyOf: (SongInfo) -> String,
): NormalizedPlaylist {
    if (songs.isEmpty()) return NormalizedPlaylist(emptyList(), 0)
    val safeCurrentIndex = currentIndex.coerceIn(0, songs.lastIndex)
    val currentKey = keyOf(songs[safeCurrentIndex])
    val seenKeys = HashSet<String>(songs.size)
    val normalizedSongs = songs.filter { seenKeys.add(keyOf(it)) }
    val normalizedIndex = normalizedSongs.indexOfFirst { keyOf(it) == currentKey }
        .coerceAtLeast(0)
    return NormalizedPlaylist(normalizedSongs, normalizedIndex)
}

/**
 * 把插播歌曲放到请求位置。已有歌曲只移动位置，不在主播放列表中复制。
 */
internal fun planPlayNextPlacement(
    songs: List<SongInfo>,
    requestedIndex: Int,
    song: SongInfo,
    keyOf: (SongInfo) -> String,
): PlayNextPlacement {
    val songKey = keyOf(song)
    val previousIndex = songs.indexOfFirst { keyOf(it) == songKey }.takeIf { it >= 0 }
    val updatedSongs = songs.toMutableList()
    if (previousIndex != null) {
        updatedSongs.removeAt(previousIndex)
    }

    val adjustedIndex = if (previousIndex != null && previousIndex < requestedIndex) {
        requestedIndex - 1
    } else {
        requestedIndex
    }
    val targetIndex = adjustedIndex.coerceIn(0, updatedSongs.size)
    updatedSongs.add(targetIndex, song)
    return PlayNextPlacement(
        songs = updatedSongs,
        previousIndex = previousIndex,
        targetIndex = targetIndex,
    )
}
