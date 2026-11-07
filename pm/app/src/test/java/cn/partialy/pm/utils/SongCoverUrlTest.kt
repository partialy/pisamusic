package cn.partialy.pm.utils

import org.junit.Assert.assertEquals
import org.junit.Test

class SongCoverUrlTest {
    @Test
    fun kgPlayerCoverUses720Template() {
        assertEquals(
            "https://example.com/720.jpg",
            SongCoverUrl.getRemoteCover("kg", "https://example.com/{size}.jpg", SongCoverUrl.SIZE_PLAYER),
        )
    }

    @Test
    fun wyPlayerCoverUses720AndReplacesExistingThumbnailParams() {
        assertEquals(
            "https://example.com/cover.jpg?param=720y720",
            SongCoverUrl.getRemoteCover("wy", "http://example.com/cover.jpg?param=100y100", SongCoverUrl.SIZE_PLAYER),
        )
        assertEquals(
            "https://example.com/cover.jpg?param=720y720",
            SongCoverUrl.getRemoteCover("wy", "https://example.com/cover.jpg", SongCoverUrl.SIZE_PLAYER),
        )
        assertEquals(
            "https://example.com/cover.jpg?foo=bar&param=720y720",
            SongCoverUrl.getRemoteCover("wy", "https://example.com/cover.jpg?foo=bar&param=200y200", SongCoverUrl.SIZE_PLAYER),
        )
    }
}
