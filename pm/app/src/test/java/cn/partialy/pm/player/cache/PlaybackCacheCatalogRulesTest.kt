package cn.partialy.pm.player.cache

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackCacheCatalogRulesTest {

    private val song = SongInfo(
        id = " 123 ",
        type = SongType.WY,
        name = "测试歌曲",
        artist = "测试歌手",
        coverUrl = "https://example.com/cover.jpg",
        album = null,
        duration = null,
    )
    private val identity = CacheIdentity.create("WY", song.id, "AUTO")

    @Test
    fun `catalog write values never contain origin url`() {
        val values = PlaybackCacheCatalogValues.from(song, identity, nowMillis = 1234L)

        assertFalse("play_url" in values)
        assertEquals("partial", values["status"])
        assertEquals(identity.cacheKey, values["cache_key"])
        assertEquals(0L, values["cached_bytes"])
        assertEquals(0L, values["total_bytes"])
        assertEquals("", values["album"])
        assertNull(values["duration"])
        assertEquals(1234L, values["updated_at"])
        assertEquals(1234L, values["last_accessed_at"])
    }

    @Test
    fun `only ready rows with known complete bytes map to fallback candidates`() {
        assertFalse(PlaybackCacheCatalogRules.isReady("partial", 1000, 1000))
        assertFalse(PlaybackCacheCatalogRules.isReady("ready", 0, 0))
        assertFalse(PlaybackCacheCatalogRules.isReady("ready", 1000, 999))
        assertFalse(PlaybackCacheCatalogRules.isReady("ready", 1000, 1001))
        assertFalse(PlaybackCacheCatalogRules.isReady(null, 1000, 1000))
        assertTrue(PlaybackCacheCatalogRules.isReady("READY", 1000, 1000))
    }
}
