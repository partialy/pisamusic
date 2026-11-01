package cn.partialy.pm.ui.playlistdetail

import org.junit.Assert.assertEquals
import org.junit.Test

class OnlinePlaylistPageRulesTest {
    @Test fun staleWyHintDoesNotStopAFullPage() {
        assertEquals(OnlinePlaylistPageOutcome.CONTINUE,
            onlinePlaylistPageOutcome(30, 60, 30, 30, totalIsAuthoritative = false))
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE,
            onlinePlaylistPageOutcome(30, 60, 0, 30, totalIsAuthoritative = false))
    }

    @Test fun shortKgPageBeforeKnownTotalNeedsMoreAndEmptyGapFails() {
        assertEquals(OnlinePlaylistPageOutcome.CONTINUE, onlinePlaylistPageOutcome(100, 40, 10, 30))
        assertEquals(OnlinePlaylistPageOutcome.FAILED, onlinePlaylistPageOutcome(100, 40, 0, 30))
    }

    @Test fun repeatedRawPageFailsEvenAtExpectedTotal() {
        assertEquals(OnlinePlaylistPageOutcome.FAILED,
            onlinePlaylistPageOutcome(60, 60, 30, 30, repeatedPage = true))
    }

    @Test fun invalidAndDuplicateRowsDoNotChangeRawCompletion() {
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE, onlinePlaylistPageOutcome(60, 60, 30, 30))
        assertEquals(OnlinePlaylistPageOutcome.CONTINUE, onlinePlaylistPageOutcome(90, 60, 30, 30))
    }

    @Test fun kgRequiresAuthoritativeNonnegativeTotalAndConsistentCursor() {
        assertEquals(OnlinePlaylistPageOutcome.FAILED, onlinePlaylistPageOutcome(-1, 0, 0, 30))
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE, onlinePlaylistPageOutcome(0, 0, 0, 30))
        assertEquals(OnlinePlaylistPageOutcome.FAILED, onlinePlaylistPageOutcome(0, 1, 1, 30))
        assertEquals(OnlinePlaylistPageOutcome.FAILED, onlinePlaylistPageOutcome(10, 30, 30, 30))
    }

    @Test fun wyShortPageAndExplicitEmptyPageCanFinish() {
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE,
            onlinePlaylistPageOutcome(-1, 31, 1, 30, totalIsAuthoritative = false))
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE,
            onlinePlaylistPageOutcome(-1, 0, 0, 30, totalIsAuthoritative = false))
    }
}
