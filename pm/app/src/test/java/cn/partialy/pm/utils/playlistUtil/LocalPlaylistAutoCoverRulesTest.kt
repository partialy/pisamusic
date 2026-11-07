package cn.partialy.pm.utils.playlistUtil

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LocalPlaylistAutoCoverRulesTest {
    private fun song(id: String, type: SongType = SongType.KG, cover: String = "https://example.com/$id.jpg") =
        SongInfo(id = id, type = type, name = "Song $id", artist = "Artist", coverUrl = cover)

    @Test fun emptyOrLocalLastSongLeavesCoverUnchanged() {
        assertNull(LocalPlaylistAutoCoverRules.fromLastAddedSong(emptyList()))
        assertNull(LocalPlaylistAutoCoverRules.fromLastAddedSong(listOf(song("a"), song("b", SongType.LOCAL))))
    }

    @Test fun lastAddedSongIsAuthoritativeEvenWhenItsCoverIsMissing() {
        assertNull(LocalPlaylistAutoCoverRules.fromLastAddedSong(listOf(song("a"), song("b", cover = ""))))
        assertEquals("https://example.com/b.jpg",
            LocalPlaylistAutoCoverRules.fromLastAddedSong(listOf(song("a"), song("b"))))
    }

    @Test fun invalidOrLocalFileCoverIsIgnored() {
        assertNull(LocalPlaylistAutoCoverRules.fromLastAddedSong(listOf(song("b", cover = "local_file:/x"))))
        assertNull(LocalPlaylistAutoCoverRules.fromLastAddedSong(listOf(song("b", cover = "not a URL"))))
    }

    @Test fun knownKgTemplateIsPreservedForDisplayTimeSizing() {
        assertEquals("https://imgessl.kugou.com/{size}/image.jpg",
            LocalPlaylistAutoCoverRules.fromLastAddedSong(listOf(
                song("a", SongType.KG, "https://imgessl.kugou.com/{size}/image.jpg"),
            )))
    }

    @Test fun duplicatesAreFilteredByCallerBeforeSelectingLastAddedSong() {
        val submitted = listOf(song("a"), song("b"), song("a"))
        val alreadyStored = setOf(SongType.KG to "a")
        val successfulAdditions = submitted.distinctBy { it.type to it.id }
            .filter { (it.type to it.id) !in alreadyStored }
        assertEquals("https://example.com/b.jpg",
            LocalPlaylistAutoCoverRules.fromLastAddedSong(successfulAdditions))
    }
}
