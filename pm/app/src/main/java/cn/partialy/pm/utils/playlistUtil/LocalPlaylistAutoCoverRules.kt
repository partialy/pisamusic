package cn.partialy.pm.utils.playlistUtil

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.playlistdetail.requestablePlaylistCoverCandidates

/** 只使用最后一首实际新增歌曲；无封面或本地音源均不更改旧封面。 */
object LocalPlaylistAutoCoverRules {
    fun fromLastAddedSong(addedSongs: List<SongInfo>): String? {
        val last = addedSongs.lastOrNull() ?: return null
        if (last.type == SongType.LOCAL) return null
        return requestablePlaylistCoverCandidates(last.type, last.coverUrl).firstOrNull()
    }
}
