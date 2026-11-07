package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongType
import org.junit.Assert.*
import org.junit.Test

class PlaylistHeroCoverUrlTest {
    private val sizes = listOf(1024, 720, 480, 240)

    @Test fun kgTemplateAndHistoricalFixedPathUseDescendingSizes() {
        val template = "https://imgessl.kugou.com/stdmusic/{size}/a.jpg"
        assertEquals(sizes.map { template.replace("{size}", it.toString()) }, toHeroCoverCandidates(SongType.KG, template))
        val old = template.replace("{size}", "120")
        assertEquals(sizes.map { template.replace("{size}", it.toString()) } + old, toHeroCoverCandidates(SongType.KG, old))
        val unknownPath = "https://imgessl.kugou.com/240/album240.jpg"
        assertEquals(listOf(unknownPath), toHeroCoverCandidates(SongType.KG, unknownPath))
    }

    @Test fun wyResizesExistingQueryAndPreservesEncodedParametersAndFragment() {
        val url = "https://p1.music.126.net/a.jpg?token=a%2Fb%26c&param=100y100&x=240#cover"
        assertEquals(sizes.map { url.replace("100y100", "${it}y$it") } + url, toHeroCoverCandidates(SongType.WY, url))
        val unsized = "https://p1.music.126.net/a.jpg"
        assertEquals(sizes.map { "$unsized?param=${it}y$it" } + unsized, toHeroCoverCandidates(SongType.WY, unsized))
        val thumbnail = "https://p1.music.126.net/a.jpg?thumbnail=120y120&x=1#frag"
        assertEquals(thumbnail.replace("120y120", "1024y1024"), toHeroCoverCandidates(SongType.WY, thumbnail).first())
    }

    @Test fun unknownDomainsAndEncodedDimensionsAreNotGuessed() {
        for (url in listOf("https://example.com/a.jpg?param=100y100",
            "https://music.126.net.example.com/a.jpg?param=100y100",
            "https://p1.music.126.net/a.jpg?param=100%79%31%30%30",
            "https://p1.music.126.net/a.jpg?token=abc%26param=100y100")) {
            assertEquals(listOf(url), toHeroCoverCandidates(SongType.WY, url))
        }
    }

    @Test fun sourceCanBeInferredAndRawPersistenceKeepsOriginal() {
        val kg = "https://imgessl.kugou.com/{size}/a.jpg"
        assertEquals("https://imgessl.kugou.com/1024/a.jpg", toHeroCoverCandidates(null, kg).first())
        val wy = "https://p1.music.126.net/a.jpg?param=100y100"
        assertEquals(wy.replace("100y100", "1024y1024"), toHeroCoverCandidates(null, wy).first())
        assertEquals(kg, rawRemotePlaylistCoverOrNull(SongType.KG, kg))
        assertEquals(wy, rawRemotePlaylistCoverOrNull(SongType.WY, wy))
        assertEquals(sizes.map { "https://custom.test/$it/a.jpg" }, requestablePlaylistCoverCandidates(SongType.KG, "https://custom.test/{size}/a.jpg"))
    }

    @Test fun requestCandidatesRejectUnsafeOrUnresolvedAddresses() {
        for (url in listOf("", "not a URL", "local_pop", "local_file:/a.jpg", "file:///a.jpg",
            "https://user:password@example.com/a.jpg", "https://unknown.test/{size}/a.jpg")) {
            assertTrue(requestablePlaylistCoverCandidates(null, url).isEmpty())
            assertEquals(null, rawRemotePlaylistCoverOrNull(null, url))
        }
    }
}
