package cn.partialy.pm.utils

import org.junit.Assert.assertEquals
import org.junit.Test

class LocalSongStoreTest {
    @Test
    fun `playback id prefers content uri over file path`() {
        val playbackId = LocalSongStore.resolvePlaybackId(
            contentUri = "content://media/external/audio/media/42",
            filePath = "/storage/emulated/0/Music/song.mp3",
            recordId = "media_store:42",
        )

        assertEquals("content://media/external/audio/media/42", playbackId)
    }

    @Test
    fun `playback id falls back to file path then record id`() {
        assertEquals(
            "/storage/emulated/0/Music/song.mp3",
            LocalSongStore.resolvePlaybackId(
                contentUri = "",
                filePath = "/storage/emulated/0/Music/song.mp3",
                recordId = "media_store:42",
            ),
        )
        assertEquals(
            "media_store:42",
            LocalSongStore.resolvePlaybackId(
                contentUri = "",
                filePath = "",
                recordId = "media_store:42",
            ),
        )
    }
}
