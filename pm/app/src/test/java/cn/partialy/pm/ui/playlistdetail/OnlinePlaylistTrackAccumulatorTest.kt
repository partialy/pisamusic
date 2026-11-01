package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cookie.model.WyPlaylistTrackSong
import cn.partialy.pm.network.cookie.model.toSongInfoOrNull
import org.junit.Assert.*
import org.junit.Test

class OnlinePlaylistTrackAccumulatorTest {
    private fun song(id: String, type: SongType = SongType.KG, name: String = id, playable: Boolean = true) =
        SongInfo(id, type, name, "artist", "https://image.test/a.jpg", album = "album", duration = 123,
            playable = playable)

    @Test fun preservesOrderFirstMetadataAndCountsAllSkippedRows() {
        val accumulator = OnlinePlaylistTrackAccumulator(emptyList())
        val first = song("1", name = "first")
        accumulator.append(listOf(first, null, song(""), song("1", name = "duplicate")))
        accumulator.append(listOf(song("2"), song("1", SongType.WY), song("0", SongType.WY)))
        assertEquals(listOf(first, song("2"), song("1", SongType.WY)), accumulator.songs())
        assertEquals(4, accumulator.skippedCount)
    }

    @Test fun knownUnplayableSeedSurvivesFreshMapperDefaultWithoutKeepingMissingSeedRows() {
        val accumulator = OnlinePlaylistTrackAccumulator(listOf(song("1", playable = false), song("removed")))
        accumulator.append(listOf(song("1", name = "fresh")))
        val result = accumulator.songs().single()
        assertFalse(result.playable)
        assertEquals("fresh", result.name)
        assertEquals("album", result.album)
        assertEquals(123, result.duration)
        assertEquals(2, accumulator.partialWithSeed().size)
    }

    @Test fun validWyIdWithBlankNameIsRetainedOnlyByExplicitCompleteLoaderMapping() {
        val raw = WyPlaylistTrackSong(id = 42, name = "")
        assertNull(raw.toSongInfoOrNull())
        assertEquals("42", raw.toSongInfoOrNull(allowBlankName = true)?.id)
        assertEquals("", raw.toSongInfoOrNull(allowBlankName = true)?.name)
    }
}
