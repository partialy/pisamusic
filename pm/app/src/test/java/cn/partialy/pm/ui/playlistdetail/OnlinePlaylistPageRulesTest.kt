package cn.partialy.pm.ui.playlistdetail

import org.junit.Assert.assertEquals
import org.junit.Test

class OnlinePlaylistPageRulesTest {
    @Test fun staleWyTotalHintDoesNotStopAtOldPlaylistSize() {
        assertEquals(OnlinePlaylistPageOutcome.CONTINUE,
            onlinePlaylistPageOutcome(30, 30, 30, 30, 30, totalIsAuthoritative = false))
        assertEquals(OnlinePlaylistPageOutcome.CONTINUE,
            onlinePlaylistPageOutcome(30, 60, 30, 30, 30, totalIsAuthoritative = false))
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE,
            onlinePlaylistPageOutcome(30, 60, 0, 0, 30, totalIsAuthoritative = false))
    }

    @Test fun shortPageBeforeKnownTotalDoesNotClaimCompletion() {
        assertEquals(OnlinePlaylistPageOutcome.CONTINUE, onlinePlaylistPageOutcome(100, 40, 10, 10, 30))
        assertEquals(OnlinePlaylistPageOutcome.FAILED, onlinePlaylistPageOutcome(100, 40, 0, 0, 30))
    }

    @Test fun repeatedLastPageCannotFalselyCompletePlaylist() {
        assertEquals(OnlinePlaylistPageOutcome.FAILED, onlinePlaylistPageOutcome(60, 60, 30, 0, 30))
    }

    @Test fun knownTotalUsesRawOffsetRatherThanMappedSongCount() {
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE, onlinePlaylistPageOutcome(60, 60, 30, 28, 30))
    }

    @Test fun unknownTotalNeedsShortPageAndCanRepresentEmptyPlaylist() {
        assertEquals(OnlinePlaylistPageOutcome.CONTINUE, onlinePlaylistPageOutcome(0, 30, 30, 30, 30))
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE, onlinePlaylistPageOutcome(0, 31, 1, 1, 30))
        assertEquals(OnlinePlaylistPageOutcome.COMPLETE, onlinePlaylistPageOutcome(0, 0, 0, 0, 30))
    }
}
