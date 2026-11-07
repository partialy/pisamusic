package cn.partialy.pm.utils

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.*
import org.junit.Test

class PlayerCoverCandidatesTest {
    @Test fun kgTemplateAndFixedSnapshotsHaveSmallerFallbacks() {
        for (url in listOf("http://imge.kugou.com/stdmusic/{size}/a.jpg", "https://imge.kugou.com/stdmusic/720/a.jpg")) {
            val song = SongInfo("id", SongType.KG, "歌名", "歌手", url)
            val urls = SongCoverUrl.getPlayerCoverCandidates(song)
            assertEquals("https://imge.kugou.com/stdmusic/720/a.jpg", urls.first())
            assertTrue(urls.contains("https://imge.kugou.com/stdmusic/480/a.jpg"))
            assertTrue(urls.contains("https://imge.kugou.com/stdmusic/240/a.jpg"))
            assertFalse(urls.any { "{size}" in it.toString() })
            assertEquals(urls.distinct(), urls)
        }
    }

    @Test fun arbitraryHostsAreNotRewrittenAndLocalArtUsesBytes() {
        val song = SongInfo("id", SongType.KG, "歌名", "歌手", "https://example.com/stdmusic/720/a.jpg")
        assertEquals(listOf(song.coverUrl), SongCoverUrl.getPlayerCoverCandidates(song))
        val art = byteArrayOf(1, 2, 3)
        assertSame(art, SongCoverUrl.getPlayerCoverCandidates(song.copy(type = SongType.LOCAL, embeddedCoverArt = art)).single())
    }
}
