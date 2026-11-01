package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistHeroCoverUrlTest {
    @Test
    fun kgTemplateGetsHighResolutionAndUsableOriginalSizeFallback() {
        assertEquals(
            listOf("https://imgessl.kugou.com/500/cover.jpg", "https://imgessl.kugou.com/240/cover.jpg"),
            toHeroCoverCandidates(SongType.KG, "https://imgessl.kugou.com/{size}/cover.jpg"),
        )
    }

    @Test
    fun unknownFixedKgPathIsNotGuessed() {
        val original = "https://imgessl.kugou.com/240/album240.jpg"
        assertEquals(listOf(original), toHeroCoverCandidates(SongType.KG, original))
    }

    @Test
    fun wyChangesOnlyDimensionsAndPreservesRawQueryAndFragment() {
        val original = "https://p1.music.126.net/a.jpg?token=a%2Fb%26c&param=100y100&x=240#cover"
        assertEquals(
            listOf(original.replace("100y100", "500y500"), original),
            toHeroCoverCandidates(SongType.WY, original),
        )
    }

    @Test
    fun alreadyLargeOrUnsizedWyIsNotDuplicated() {
        for (url in listOf("https://p1.music.126.net/a.jpg?param=500y500", "https://p1.music.126.net/a.jpg")) {
            assertEquals(listOf(url), toHeroCoverCandidates(SongType.WY, url))
        }
    }

    @Test
    fun unknownDomainsAndEncodedValuesAreNotModified() {
        for (url in listOf(
            "https://example.com/a.jpg?param=100y100",
            "https://music.126.net.example.com/a.jpg?param=100y100",
            "https://p1.music.126.net/a.jpg?param=100%79%31%30%30",
            "https://p1.music.126.net/a.jpg?token=abc%26param=100y100",
        )) {
            assertEquals(listOf(url), toHeroCoverCandidates(SongType.WY, url))
        }
    }

    @Test
    fun blankAndInvalidAddressesRemainSafe() {
        assertTrue(toHeroCoverCandidates(null, " ").isEmpty())
        assertEquals(listOf("not a URL"), toHeroCoverCandidates(null, "not a URL"))
    }

    @Test
    fun legacyRemoteCallersCanInferKnownKgAndWyHosts() {
        assertEquals("https://p1.music.126.net/a.jpg?param=500y500",
            toHeroCoverCandidates(null, "https://p1.music.126.net/a.jpg?param=140y140").first())
        assertEquals("https://imgessl.kugou.com/500/a.jpg",
            toHeroCoverCandidates(null, "https://imgessl.kugou.com/{size}/a.jpg").first())
    }
}
