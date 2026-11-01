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
    fun `kugou gcid is explicitly unsupported`() {
        assertEquals(PlaylistShareLinkResult.UnsupportedKugou, PlaylistShareLinkParser.parse("发现歌单 https://m.kugou.com/songlist/gcid_3zegxuo8z2az082/?chl=message。"))
        assertEquals(PlaylistShareLinkResult.Invalid, PlaylistShareLinkParser.parse("https://kugou.com.evil.test/songlist/gcid_123"))
    }
}
