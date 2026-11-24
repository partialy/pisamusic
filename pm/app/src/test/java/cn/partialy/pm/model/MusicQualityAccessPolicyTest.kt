package cn.partialy.pm.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MusicQualityAccessPolicyTest {
    private val guest = MusicQualityAccessState(loggedIn = false, vipActive = false)
    private val regular = MusicQualityAccessState(loggedIn = true, vipActive = false)
    private val vip = MusicQualityAccessState(loggedIn = true, vipActive = true)

    @Test
    fun unsetPlaybackQualityDefaultsToFirstTierForAllUsers() {
        val kgFirst = DownloadQualityChoice.Kugou("128")
        val wyFirst = DownloadQualityChoice.NeteaseBr(128_000)

        assertEquals(kgFirst, MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.KG, null, guest))
        assertEquals(kgFirst, MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.KG, null, regular))
        assertEquals(kgFirst, MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.KG, null, vip))

        assertEquals(wyFirst, MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.WY, null, guest))
        assertEquals(wyFirst, MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.WY, null, regular))
        assertEquals(wyFirst, MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.WY, null, vip))

        assertEquals(DownloadQualityChoice.CloudDefault, MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.CLOUD, null, guest))
        assertNull(MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.KW, null, vip))
    }

    @Test
    fun restrictedPlaybackQualityFallsBackToFirstTier() {
        val kgFirst = DownloadQualityChoice.Kugou("128")
        val wyFirst = DownloadQualityChoice.NeteaseBr(128_000)

        assertEquals(
            kgFirst,
            MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.KG, DownloadQualityChoice.Kugou("flac"), regular),
        )
        assertEquals(
            kgFirst,
            MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.KG, DownloadQualityChoice.Kugou("320"), guest),
        )
        assertEquals(
            wyFirst,
            MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.WY, DownloadQualityChoice.NeteaseLevel("jymaster"), regular),
        )
        assertEquals(
            DownloadQualityChoice.NeteaseLevel("exhigh"),
            MusicQualityAccessPolicy.allowedChoiceOrFallback(SongType.WY, DownloadQualityChoice.NeteaseLevel("exhigh"), regular),
        )
    }

    @Test
    fun downloadDefaultResolutionHandlesAskAllowedAndRestrictedStates() {
        assertEquals(
            DownloadQualityResolution.AskEveryTime,
            MusicQualityAccessPolicy.resolveDownloadDefaultChoice(SongType.KG, null, vip),
        )
        assertEquals(
            DownloadQualityResolution.AskEveryTime,
            MusicQualityAccessPolicy.resolveDownloadDefaultChoice(
                SongType.WY,
                MusicQualityAccessPolicy.DOWNLOAD_QUALITY_ASK,
                vip,
            ),
        )
        assertEquals(
            DownloadQualityResolution.Allowed(DownloadQualityChoice.Kugou("flac")),
            MusicQualityAccessPolicy.resolveDownloadDefaultChoice(SongType.KG, "kg:flac", vip),
        )
        assertEquals(
            DownloadQualityResolution.Restricted(DownloadQualityChoice.Kugou("flac")),
            MusicQualityAccessPolicy.resolveDownloadDefaultChoice(SongType.KG, "kg:flac", regular),
        )
        assertEquals(
            DownloadQualityResolution.Allowed(DownloadQualityChoice.NeteaseBr(128_000)),
            MusicQualityAccessPolicy.resolveDownloadDefaultChoice(SongType.WY, "wy-br:128000", guest),
        )
        assertEquals(
            DownloadQualityResolution.Restricted(DownloadQualityChoice.NeteaseLevel("hires")),
            MusicQualityAccessPolicy.resolveDownloadDefaultChoice(SongType.WY, "wy-level:hires", guest),
        )
        assertEquals(
            DownloadQualityResolution.AskEveryTime,
            MusicQualityAccessPolicy.resolveDownloadDefaultChoice(SongType.KG, "wy-br:128000", vip),
        )
    }
}
