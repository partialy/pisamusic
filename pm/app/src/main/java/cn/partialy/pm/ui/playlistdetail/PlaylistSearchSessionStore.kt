package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo

object PlaylistSearchSessionStore {
    var songs: List<SongInfo> = emptyList()
    var playlistTitle: String = ""
    var sourceId: String? = null

    fun setSession(songs: List<SongInfo>, title: String = "", sourceId: String? = null) {
        this.songs = songs
        this.playlistTitle = title
        this.sourceId = sourceId
    }

    fun clear() {
        songs = emptyList()
        playlistTitle = ""
        sourceId = null
    }
}
