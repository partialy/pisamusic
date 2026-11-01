package cn.partialy.pm.utils.playlistUtil

import org.junit.Assert.assertEquals
import org.junit.Test

class PlaylistShareLinkParserTest {
    @Test
    fun `share copy handles escaped colon and extra parameters`() {
        assertEquals(
            PlaylistShareLinkResult.Netease("12546496382"),
            PlaylistShareLinkParser.parse("分享歌单: 忆昔喜欢的音乐 i_忆昔 https\\://music.163.com/m/playlist?id=12546496382&creatorId=549090146。"),
        )
    }

    @Test
    fun `desktop fragment and encoded query are supported`() {
        assertEquals(PlaylistShareLinkResult.Netease("123"), PlaylistShareLinkParser.parse("https://music.163.com/#/playlist?creatorId=7&id=%31%32%33"))
        assertEquals(PlaylistShareLinkResult.Netease("123"), PlaylistShareLinkParser.parse("https://music.163.com/playlist?x=1&amp;id=123"))
    }

    @Test
    fun `invalid ids and non playlist links are rejected`() {
        listOf("", "0", "-1", "abc", "1.5", "999999999999999999999999").forEach { id ->
            assertEquals(PlaylistShareLinkResult.Invalid, PlaylistShareLinkParser.parse("https://music.163.com/playlist?id=$id"))
        }
        listOf("123", "https://music.163.com/song?id=123", "https://163cn.tv/short", "https://music.163.com.evil.test/playlist?id=123", "https://music.163.com@evil.test/playlist?id=123").forEach {
            assertEquals(PlaylistShareLinkResult.Invalid, PlaylistShareLinkParser.parse(it))
        }
    }

    @Test
    fun `first valid supported playlist wins`() {
        assertEquals(
            PlaylistShareLinkResult.Netease("123"),
            PlaylistShareLinkParser.parse("https://m.kugou.com/songlist/gcid_x/ https://music.163.com/playlist?id=bad https://music.163.com/playlist?id=123 https://music.163.com/playlist?id=456"),
        )
    }

    @Test
    fun `kugou share decodes copy identity instead of source parameter`() {
        assertEquals(PlaylistShareLinkResult.Kugou("collection_3_760768723_80_0"),
            PlaylistShareLinkParser.parse("发现一个很不错的歌单哦《快手抖音热门DJ》https://m.kugou.com/songlist/gcid_3zegxuo8z2az082/?src_cid=3zhy2r89z2wz09e&chl=message。"))
        assertEquals(PlaylistShareLinkResult.Kugou("collection_3_944012239_102_0"),
            PlaylistShareLinkParser.parse("https://www.kugou.com/songlist/gcid_3zhy2r89z2wz09e/"))
    }

    @Test
    fun `invalid kugou ids and hosts cannot become playlist identities`() {
        assertEquals(PlaylistShareLinkResult.Invalid, PlaylistShareLinkParser.parse("https://kugou.com.evil.test/songlist/gcid_123"))
        listOf("gcid_3zegxuo8z2az082/extra", "gcid_3z0z2az082", "gcid_3zegxuo8z0z082", "gcid_3z99999999999999999999999z2az082", "gcid_3zegxuo8z2az0", "gcid_3zegxuo8z2az08_", "gcid_bad").forEach {
            assertEquals(PlaylistShareLinkResult.Invalid, PlaylistShareLinkParser.parse("https://m.kugou.com/songlist/$it"))
        }
        assertEquals(PlaylistShareLinkResult.Invalid,
            PlaylistShareLinkParser.parse("https://user@m.kugou.com/songlist/gcid_3zegxuo8z2az082/"))
    }

    @Test
    fun `mixed platforms use first valid playlist in text order`() {
        val kg = "https://m.kugou.com/songlist/gcid_3zegxuo8z2az082/"
        val wy = "https://music.163.com/playlist?id=123"
        assertEquals(PlaylistShareLinkResult.Kugou("collection_3_760768723_80_0"), PlaylistShareLinkParser.parse("$kg $wy"))
        assertEquals(PlaylistShareLinkResult.Netease("123"), PlaylistShareLinkParser.parse("$wy $kg"))
    }
}
