package cn.partialy.pm.download

import org.junit.Assert.*
import org.junit.Test

class DownloadTargetNamingTest {
    @Test fun differentAudioFormatsShareLyricsNamespace() {
        assertEquals(downloadTargetBasename("song - artist.mp3"), downloadTargetBasename("song - artist.flac"))
        assertEquals(downloadTargetBasename("song - artist.mp3"), downloadTargetBasename("song - artist.lrc"))
        assertEquals(downloadTargetBasename("song - artist.mp3.part"), downloadTargetBasename("song - artist.krc"))
    }

    @Test fun sourceSuffixSeparatesNamespacesAndPreservesDotsInTitles() {
        assertNotEquals(downloadTargetBasename("song.part - artist.mp3"), downloadTargetBasename("song.part - artist [kg-123].flac"))
        assertEquals("song.part - artist", downloadTargetBasename("song.part - artist.mp3"))
    }
}
