package cn.partialy.pm.announcement

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AnnouncementActionExecutorTest {

    @Test
    fun `action type url validates strictly https`() {
        val validUrl = AnnouncementAction.Url(url = "https://pisamusic.partialy.cn")
        val invalidHttpUrl = AnnouncementAction.Url(url = "http://pisamusic.partialy.cn")
        val invalidJsUrl = AnnouncementAction.Url(url = "javascript:alert(1)")

        assertTrue(isAllowedAnnouncementUrl(validUrl.url))
        assertFalse(isAllowedAnnouncementUrl(invalidHttpUrl.url))
        assertFalse(isAllowedAnnouncementUrl(invalidJsUrl.url))
    }

    @Test
    fun `action type protocol validates strictly pisamusic scheme`() {
        val validProtocol = AnnouncementAction.Protocol(value = "pisamusic://scan?type=listen-together-join&roomId=654321")
        val invalidProtocol = AnnouncementAction.Protocol(value = "myapp://scan?type=listen-together-join&roomId=654321")

        assertTrue(isAllowedAnnouncementProtocol(validProtocol.value))
        assertFalse(isAllowedAnnouncementProtocol(invalidProtocol.value))
    }
}
