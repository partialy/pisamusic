package cn.partialy.pm.download

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AudioFileTransactionTest {
    @get:Rule val temp = TemporaryFolder()

    @Test fun successfulReplacementKeepsOnlyNewFile() {
        val audio = temp.newFile("song.mp3").apply { writeText("original") }
        AudioFileTransaction.replace(
            original = audio,
            transform = { it.writeText("updated") },
            verify = { it.readText() == "updated" },
        )
        assertEquals("updated", audio.readText())
        assertTrue(temp.root.listFiles().orEmpty().none { it.name.contains("repair") || it.name.contains("backup") })
    }

    @Test fun transformFailurePreservesOriginalFile() {
        val audio = temp.newFile("song.flac").apply { writeText("original") }
        runCatching {
            AudioFileTransaction.replace(audio, { throw IllegalStateException("write failed") }, { true })
        }
        assertEquals("original", audio.readText())
        assertTrue(temp.root.listFiles().orEmpty().none { it.name.contains("repair") || it.name.contains("backup") })
    }

    @Test fun interruptedReplacementRestoresBackup() {
        val audio = temp.newFile("song.mp3").apply { writeText("partial") }
        val backup = temp.newFile("song.mp3.backup-test").apply { writeText("original") }
        val stage = temp.newFile("song.repair-test.mp3").apply { writeText("new") }
        val journal = temp.newFile(".test.pm-repair-journal")
        journal.writeText(listOf(audio.absolutePath, stage.absolutePath, backup.absolutePath).joinToString("\n"))
        AudioFileTransaction.recoverPending(temp.root)
        assertEquals("original", audio.readText())
        assertFalse(backup.exists())
        assertFalse(journal.exists())
    }
}
