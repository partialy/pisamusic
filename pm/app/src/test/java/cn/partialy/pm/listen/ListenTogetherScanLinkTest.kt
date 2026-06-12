package cn.partialy.pm.listen

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ListenTogetherScanLinkTest {
    @Test
    fun parsesHttpsJoinLink() {
        assertEquals(
            ListenTogetherScanLink.Action.JoinRoom("123456"),
            ListenTogetherScanLink.parse(
                "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=123456",
            ),
        )
    }

    @Test
    fun parsesAppSchemeJoinLink() {
        assertEquals(
            ListenTogetherScanLink.Action.JoinRoom("4321"),
            ListenTogetherScanLink.parse(
                "pisamusic://scan?type=listen-together-join&roomId=4321",
            ),
        )
    }

    @Test
    fun acceptsTrailingSlashAfterWebsiteRedirect() {
        assertEquals(
            ListenTogetherScanLink.Action.JoinRoom("12345678"),
            ListenTogetherScanLink.parse(
                "https://pisamusic.partialy.cn/scan/?roomId=12345678&type=listen-together-join",
            ),
        )
    }

    @Test
    fun rejectsUnknownTypeAndInvalidRoomId() {
        assertNull(
            ListenTogetherScanLink.parse(
                "https://pisamusic.partialy.cn/scan?type=unknown&roomId=123456",
            ),
        )
        assertNull(
            ListenTogetherScanLink.parse(
                "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=12ab",
            ),
        )
    }

    @Test
    fun rejectsForgedHostAndWrongPath() {
        assertNull(
            ListenTogetherScanLink.parse(
                "https://example.com/scan?type=listen-together-join&roomId=123456",
            ),
        )
        assertNull(
            ListenTogetherScanLink.parse(
                "https://pisamusic.partialy.cn/download?type=listen-together-join&roomId=123456",
            ),
        )
    }

    @Test
    fun rejectsMissingOrMalformedParameters() {
        assertNull(ListenTogetherScanLink.parse("https://pisamusic.partialy.cn/scan"))
        assertNull(
            ListenTogetherScanLink.parse(
                "https://pisamusic.partialy.cn/scan?type=listen-together-join&roomId=%",
            ),
        )
    }
}
