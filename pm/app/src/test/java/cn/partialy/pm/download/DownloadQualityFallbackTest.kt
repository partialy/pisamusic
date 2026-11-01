package cn.partialy.pm.download

import cn.partialy.pm.model.*
import org.junit.Assert.*
import org.junit.Test

class DownloadQualityFallbackTest {
    private val guest = MusicQualityAccessState(false, false)
    private val regular = MusicQualityAccessState(true, false)
    private val vip = MusicQualityAccessState(true, true)

    @Test fun kgDropsTo128WithoutUpgrading() {
        assertEquals(listOf(DownloadQualityChoice.Kugou("320"), DownloadQualityChoice.Kugou("128")),
            downloadQualityCandidates(SongType.KG, DownloadQualityChoice.Kugou("320"), regular))
    }

    @Test fun restrictedChoiceCannotBeUsedEvenAsFirstCandidate() {
        assertTrue(downloadQualityCandidates(SongType.KG, DownloadQualityChoice.Kugou("flac"), regular).isEmpty())
        assertTrue(downloadQualityCandidates(SongType.WY, DownloadQualityChoice.NeteaseLevel("hires"), guest).isEmpty())
    }

    @Test fun wyStandardCanUseEquivalentBitrateEndpointWithoutUpgrade() {
        assertEquals(listOf(DownloadQualityChoice.NeteaseLevel("standard"), DownloadQualityChoice.NeteaseBr(128_000)),
            downloadQualityCandidates(SongType.WY, DownloadQualityChoice.NeteaseLevel("standard"), guest))
    }

    @Test fun wyRegularFallbackStillObeysAccountPolicy() {
        val candidates = downloadQualityCandidates(SongType.WY, DownloadQualityChoice.NeteaseLevel("exhigh"), regular)
        assertEquals(DownloadQualityChoice.NeteaseLevel("exhigh"), candidates.first())
        assertFalse(candidates.contains(DownloadQualityChoice.NeteaseBr(320_000)))
        assertTrue(candidates.all { MusicQualityAccessPolicy.isChoiceAllowed(SongType.WY, it, regular) })
    }

    @Test fun vipFallsBackOnlyAtOrBelowRequestedRank() {
        val requested = DownloadQualityChoice.NeteaseLevel("lossless")
        val candidates = downloadQualityCandidates(SongType.WY, requested, vip)
        assertTrue(candidates.all { downloadQualityRank(it) <= downloadQualityRank(requested) })
        assertTrue(candidates.contains(DownloadQualityChoice.NeteaseBr(320_000)))
    }

    @Test fun cloudHasOneChoiceAndCrossSourceIsRejected() {
        assertEquals(listOf(DownloadQualityChoice.CloudDefault), downloadQualityCandidates(SongType.CLOUD, DownloadQualityChoice.CloudDefault, guest))
        assertTrue(downloadQualityCandidates(SongType.KG, DownloadQualityChoice.NeteaseBr(128_000), vip).isEmpty())
    }

    @Test fun highFlacBitrateWithoutLevelDoesNotInventLosslessDowngrade() {
        val hires = DownloadQualityChoice.NeteaseLevel("hires")
        assertEquals(hires, reportedWyDownloadChoice(hires, 2_304_000, null))
    }

    @Test fun responseLevelIsAuthoritativeForHighQualityDowngrade() {
        assertEquals(DownloadQualityChoice.NeteaseLevel("lossless"), reportedWyDownloadChoice(
            DownloadQualityChoice.NeteaseLevel("hires"), 1_411_000, "lossless"))
    }

    @Test fun bitrate192MapsToExistingHigherOption() {
        assertEquals(DownloadQualityChoice.NeteaseLevel("higher"), reportedWyDownloadChoice(
            DownloadQualityChoice.NeteaseBr(320_000), 192_000, null))
    }

    @Test(expected = DownloadResolutionException::class)
    fun responseLevelCannotUpgradeRequestedQuality() {
        reportedWyDownloadChoice(DownloadQualityChoice.NeteaseLevel("lossless"), 2_304_000, "hires")
    }

    @Test(expected = DownloadResolutionException::class)
    fun responseBitrateCannotUpgradeStandard() {
        reportedWyDownloadChoice(DownloadQualityChoice.NeteaseLevel("standard"), 320_000, null)
    }
}
