package cn.partialy.pm.utils

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppVersionComparatorTest {

    @Test
    fun `app version greater than server version returns false`() {
        // "2.6.0" 大于 2.5.x 不提示更新
        assertFalse(AppVersionComparator.isServerVersionNewer("2.6.0", "2.5.0"))
        assertFalse(AppVersionComparator.isServerVersionNewer("2.6.0", "2.5.9"))
        assertFalse(AppVersionComparator.isServerVersionNewer("2.6.0", "2.5.99"))

        // "3.6.0" 大于 2.x.x 不提示更新
        assertFalse(AppVersionComparator.isServerVersionNewer("3.6.0", "2.6.0"))
        assertFalse(AppVersionComparator.isServerVersionNewer("3.6.0", "2.9.9"))
        assertFalse(AppVersionComparator.isServerVersionNewer("3.0.0", "2.9.9"))
    }

    @Test
    fun `same version returns false`() {
        assertFalse(AppVersionComparator.isServerVersionNewer("2.6.0", "2.6.0"))
        assertFalse(AppVersionComparator.isServerVersionNewer("v2.6.0", "2.6.0"))
        assertFalse(AppVersionComparator.isServerVersionNewer("2.6.0", "v2.6.0"))
        assertFalse(AppVersionComparator.isServerVersionNewer("2.6", "2.6.0"))
    }

    @Test
    fun `server version strictly greater returns true`() {
        assertTrue(AppVersionComparator.isServerVersionNewer("2.6.0", "2.6.1"))
        assertTrue(AppVersionComparator.isServerVersionNewer("2.6.0", "2.7.0"))
        assertTrue(AppVersionComparator.isServerVersionNewer("2.6.0", "3.0.0"))
        assertTrue(AppVersionComparator.isServerVersionNewer("2.6.0", "2.6.0.1"))
    }

    @Test
    fun `invalid or blank versions return false`() {
        assertFalse(AppVersionComparator.isServerVersionNewer(null, "2.6.0"))
        assertFalse(AppVersionComparator.isServerVersionNewer("2.6.0", null))
        assertFalse(AppVersionComparator.isServerVersionNewer("", "2.6.0"))
        assertFalse(AppVersionComparator.isServerVersionNewer("2.6.0", ""))
        assertFalse(AppVersionComparator.isServerVersionNewer("invalid", "not-a-version"))
    }
}
