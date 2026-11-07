package cn.partialy.pm.download

import org.junit.Assert.*
import org.junit.Test

class DownloadResumePolicyTest {
    @Test fun acceptsOnlyExactValidatedRange() {
        assertEquals(100L, DownloadResumePolicy.validatedTotal("bytes 40-99/100", 40, 100, 60, true))
        listOf("bytes 0-99/100", "bytes 40-100/100", "bytes 40-99/*", "bytes 40-99/101", "bytes */100", "bytes 999999999999999999999-99/100").forEach {
            assertEquals(-1L, DownloadResumePolicy.validatedTotal(it, 40, 100, 60, true))
        }
        assertEquals(-1L, DownloadResumePolicy.validatedTotal("bytes 40-99/100", 40, 100, 59, true))
        assertEquals(-1L, DownloadResumePolicy.validatedTotal("bytes 40-99/100", 40, 100, 60, false))
    }
    @Test fun removedAndPreviousAttemptsNeverWrite() {
        assertTrue(DownloadResumePolicy.acceptsGeneration(2, 2, false))
        assertFalse(DownloadResumePolicy.acceptsGeneration(1, 2, false))
        assertFalse(DownloadResumePolicy.acceptsGeneration(2, 2, true))
        assertFalse(DownloadResumePolicy.acceptsGeneration(0, -1, false))
    }
}
