package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.KgPlaylistTrackAllData
import cn.partialy.pm.network.cookie.model.WyPlaylistAuthorityTrack
import cn.partialy.pm.network.cookie.model.WyPlaylistDetailAuthority
import cn.partialy.pm.network.cookie.model.WyPlaylistDetailAuthorityResponse
import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Test

class OnlinePlaylistMembershipRulesTest {
    private fun response(count: Int?, ids: List<Long?>?) = WyPlaylistDetailAuthorityResponse(200,
        WyPlaylistDetailAuthority(42, count, ids?.map { WyPlaylistAuthorityTrack(it) }))

    @Test fun explicitEmptyMembershipIsConfirmedButMissingOrPartialFieldsFail() {
        assertTrue(response(0, emptyList()).requireCompleteMembership("42").isEmpty())
        for (invalid in listOf(response(null, emptyList()), response(0, null), response(2, listOf(1)),
            response(-1, emptyList()), response(0, emptyList()).copy(code = null),
            response(0, emptyList()).copy(playlist = null))) {
            assertTrue(runCatching { invalid.requireCompleteMembership("42") }.isFailure)
        }
        assertTrue(runCatching { response(0, emptyList()).requireCompleteMembership("99") }.isFailure)
    }

    @Test fun missingReorderedAndUnexpectedTrackIdsCannotPassMembershipCheck() {
        val expected = response(3, listOf(1, 2, 3)).requireCompleteMembership("42")
        assertTrue(matchesPlaylistMembershipPage(expected, 0, listOf(1, 2)))
        assertTrue(matchesPlaylistMembershipPage(expected, 2, listOf(3)))
        assertFalse(matchesPlaylistMembershipPage(expected, 0, listOf(2, 1)))
        assertFalse(matchesPlaylistMembershipPage(expected, 2, listOf(4)))
        assertFalse(matchesPlaylistMembershipPage(expected, 3, listOf(3)))
        assertFalse(matchesPlaylistMembershipPage(expected, -1, emptyList()))
        // 空页即使有合法响应，也不能在成员快照结束前证明 complete。
        assertEquals(OnlinePlaylistPageOutcome.FAILED, onlinePlaylistPageOutcome(expected.size, 0, 0, 30))
        assertEquals(OnlinePlaylistPageOutcome.CONTINUE, onlinePlaylistPageOutcome(expected.size, 1, 1, 30))
    }

    @Test fun rawDuplicateAndInvalidMembershipRowsRemainCountable() {
        val expected = response(3, listOf(1, 1, null)).requireCompleteMembership("42")
        assertTrue(matchesPlaylistMembershipPage(expected, 0, listOf(1, 1, null)))
        assertEquals(3, expected.size)
    }

    @Test fun kgMissingCountOrRowsCannotMasqueradeAsConfirmedEmptyArray() {
        val gson = Gson()
        val missing = gson.fromJson("{}", KgPlaylistTrackAllData::class.java)
        assertEquals(-1, missing.count)
        assertNull(missing.info)
        val onlyCount = gson.fromJson("{\"count\":0}", KgPlaylistTrackAllData::class.java)
        assertEquals(0, onlyCount.count)
        assertNull(onlyCount.info)
        val explicit = gson.fromJson("{\"count\":0,\"info\":[]}", KgPlaylistTrackAllData::class.java)
        assertEquals(0, explicit.count)
        assertTrue(explicit.info?.isEmpty() == true)
    }
}
