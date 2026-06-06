package cn.partialy.pm.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SyncPayloadsTest {
    @Test
    fun parseSongFallsBackToItemKeyAndDefaultsMissingFields() {
        val song = SyncPayloads.parseSong(
            mapOf(
                "name" to null,
                "artist" to "测试歌手",
                "duration" to 210000.0,
            ),
            itemKey = "wy:12345",
        )

        assertEquals("12345", song?.id)
        assertEquals("wy", song?.source)
        assertEquals("12345", song?.urlParam)
        assertEquals("", song?.name)
        assertEquals("测试歌手", song?.singer)
        assertEquals(210000, song?.duration)
    }

    @Test
    fun parsePlaylistAcceptsLegacyNamesAndFallsBackToKey() {
        val playlist = SyncPayloads.parsePlaylist(
            mapOf(
                "title" to "我的歌单",
                "intro" to "简介",
                "coverUrl" to "https://example.com/a.jpg",
                "count" to 12.0,
            ),
            itemKey = "local:playlist-1",
        )

        assertEquals("playlist-1", playlist?.id)
        assertEquals("local", playlist?.source)
        assertEquals("我的歌单", playlist?.name)
        assertEquals("简介", playlist?.desc)
        assertEquals("https://example.com/a.jpg", playlist?.cover)
        assertEquals(12, playlist?.song_count)
    }

    @Test
    fun parseEmptyPayloadWithoutKeyReturnsNull() {
        assertNull(SyncPayloads.parseSong(emptyMap<String, Any>()))
        assertNull(SyncPayloads.parsePlaylist("{}"))
    }
}
