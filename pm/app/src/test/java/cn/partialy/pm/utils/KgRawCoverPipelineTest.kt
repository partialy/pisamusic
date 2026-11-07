package cn.partialy.pm.utils

import cn.partialy.pm.activity.toSongInfoOrNull
import cn.partialy.pm.listen.toListenTogetherSong
import cn.partialy.pm.listen.toSongInfo
import cn.partialy.pm.model.*
import cn.partialy.pm.network.search.toSearchTrackRow
import org.junit.Assert.*
import org.junit.Test

class KgRawCoverPipelineTest {
    private val raw = "https://imge.kugou.com/stdmusic/{size}/20260101/cover.jpg"

    @Test fun everySongEntryKeepsRawUntilTheImageIsRequested() {
        val search = SearchSongInfo(fileHash = "hash", songName = "歌曲", singerName = "歌手", image = raw)
        val songs = listOf(
            search.toSearchTrackRow().toSongInfo(),
            search.convertToSong()!!,
            KgPlaylistTrackRow(hash = "hash", name = "歌曲", cover = raw).toSongInfoOrNull()!!,
            RecommendSongInfo("歌曲", "歌手", "hash", raw).convertToSongInfo(),
        )
        for (song in songs) {
            assertEquals(raw, song.coverUrl)
            assertEquals(raw, song.toCanonicalSong().toSongInfo().coverUrl)
            assertEquals(raw, song.toListenTogetherSong().toSongInfo()?.coverUrl)
            assertEquals(raw.replace("{size}", "120"), SongCoverUrl.getSongCover(song, 120))
            assertEquals(raw.replace("{size}", "720"), SongCoverUrl.getPlayerCoverCandidates(song).first())
            assertEquals(raw, song.coverUrl)
        }
    }

    @Test fun historicalSmallKgCoversCanBeUsedAtAnyRequestedSize() {
        for (old in listOf(120, 240, 480)) {
            val url = raw.replace("{size}", old.toString())
            assertEquals(raw.replace("{size}", "720"), SongCoverUrl.getKgImageUrl(url, 720))
            assertEquals(raw.replace("{size}", "240"), SongCoverUrl.getRemoteCover("", url, 240))
            assertEquals(url, SongCoverUrl.getRawRemoteCover(url))
        }
        val nested = "https://imge.kugou.com/other.jpg?redirect=/stdmusic/120/a.jpg#/stdmusic/240/b.jpg"
        assertEquals(nested, SongCoverUrl.getKgImageUrl(nested, 720))
        val suffix = "?q=/stdmusic/120/b.jpg#keep"
        assertEquals(raw.replace("{size}", "720") + suffix,
            SongCoverUrl.getKgImageUrl(raw.replace("{size}", "120") + suffix, 720))
        val unrelated = "https://example.com/stdmusic/120/cover.jpg"
        assertEquals(unrelated, SongCoverUrl.getKgImageUrl(unrelated, 720))
        assertEquals(raw, SongCoverUrl.getRawRemoteCover(raw))
        assertEquals("", SongCoverUrl.getRawRemoteCover("file:///private/cover.jpg"))
    }
}
