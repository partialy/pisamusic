package cn.partialy.pm.listen

import org.junit.Assert.assertEquals
import org.junit.Test

class ListenTogetherSongCoverTest {
    @Test fun coverSizeOnlySnapshotKeepsItsCover() {
        val song = ListenTogetherSong(id = "hash", source = "kg", coverSize =
            ListenTogetherCoverSize(s = "https://imge.kugou.com/stdmusic/120/a.jpg", xl = "https://imge.kugou.com/stdmusic/720/a.jpg"))
        assertEquals("https://imge.kugou.com/stdmusic/720/a.jpg", song.toSongInfo()?.coverUrl)
    }

    @Test fun validTemplateWinsAndInvalidCoverFallsBackToSizedVariant() {
        val template = "https://imge.kugou.com/stdmusic/{size}/a.jpg"
        val song = ListenTogetherSong(id = "hash", source = "kg", cover = template,
            coverSize = ListenTogetherCoverSize(xl = "https://imge.kugou.com/stdmusic/720/a.jpg"))
        assertEquals(template, song.toSongInfo()?.coverUrl)
        assertEquals("https://imge.kugou.com/stdmusic/720/a.jpg", song.copy(cover = "undefined").toSongInfo()?.coverUrl)
    }
}
