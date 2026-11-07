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
    @Test fun lateFailureHonorsPauseAndCancel() {
        assertEquals("PAUSED", DownloadResumePolicy.stoppedFailureStatus("PAUSING"))
        assertEquals("CANCELLED", DownloadResumePolicy.stoppedFailureStatus("CANCELLED"))
        assertEquals("FAILED", DownloadResumePolicy.stoppedFailureStatus("DOWNLOADING"))
    }
    @Test fun resolvedQualityKeepsOwnerOrOldestPlaceholder() {
        assertTrue(DownloadResumePolicy.resolvedDuplicateWins(false, true, 1, "a", 2, "b"))
        assertTrue(DownloadResumePolicy.resolvedDuplicateWins(false, false, 2, "b", 1, "a"))
        assertTrue(DownloadResumePolicy.resolvedDuplicateWins(false, false, 1, "b", 1, "a"))
        assertFalse(DownloadResumePolicy.resolvedDuplicateWins(false, false, 1, "a", 2, "b"))
        assertFalse(DownloadResumePolicy.resolvedDuplicateWins(true, true, 2, "b", 1, "a"))
    }
    @Test fun derivedPartNeverEscapesParentOrTraverses() {
        val parent = java.io.File(System.getProperty("java.io.tmpdir")).canonicalFile
        assertTrue(DownloadResumePolicy.safeRecordedPath(java.io.File(parent, "download-policy-safe.part"), parent))
        assertFalse(DownloadResumePolicy.safeRecordedPath(java.io.File(parent, "../download-policy.part"), parent))
        assertFalse(DownloadResumePolicy.safeRecordedPath(java.io.File(parent.parentFile, "download-policy.part"), parent))
        assertFalse(DownloadResumePolicy.safeRecordedPath(parent, parent))
    }
    @Test fun missingCompletedFileCanRetryButExistingCompletedCannot() {
        assertTrue(DownloadResumePolicy.canRequeue("COMPLETED", true))
        assertFalse(DownloadResumePolicy.canRequeue("COMPLETED", false))
        assertTrue(DownloadResumePolicy.canRequeue("PAUSED", false))
        assertTrue(DownloadResumePolicy.canRequeue("FAILED", false))
        assertTrue(DownloadResumePolicy.canRequeue("CANCELLED", false))
        listOf("QUEUED", "PREPARING", "DOWNLOADING", "PAUSING", "PROCESSING").forEach {
            assertFalse(DownloadResumePolicy.canRequeue(it, true))
        }
    }
}
