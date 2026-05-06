package cn.partialy.pm.network.search

import cn.partialy.pm.model.SearchSongInfo
import cn.partialy.pm.model.SearchTrackRow
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.kw.KwSearchItem
import cn.partialy.pm.network.wy.WySongDto

fun SearchSongInfo.toSearchTrackRow(): SearchTrackRow {
    val hash = fileHash.ifBlank { playHash() }
    return SearchTrackRow(
        stableId = "kg_$hash",
        title = displayTitle(),
        artist = singerName,
        coverUrl = image.orEmpty().replace("{size}", "120"),
        durationSec = duration,
        source = SongType.KG,
        playRef = hash,
        album = null,
    )
}

fun WySongDto.toSearchTrackRow(): SearchTrackRow? {
    if (id == 0L) return null
    val artists = ar.joinToString("、") { it.name }.trim()
    return SearchTrackRow(
        stableId = "wy_$id",
        title = name,
        artist = artists,
        coverUrl = al?.picUrl.orEmpty(),
        durationSec = null,
        source = SongType.WY,
        playRef = id.toString(),
        album = al?.name?.takeIf { it.isNotBlank() },
    )
}

fun KwSearchItem.toSearchTrackRow(): SearchTrackRow? {
    if (id == 0L) return null
    return SearchTrackRow(
        stableId = "kw_$id",
        title = name,
        artist = artist,
        coverUrl = "",
        durationSec = duration.takeIf { it > 0 },
        source = SongType.KW,
        playRef = id.toString(),
        album = album,
    )
}
