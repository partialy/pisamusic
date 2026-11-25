package cn.partialy.pm.ui.player

import android.view.View
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextMotion
import androidx.compose.ui.unit.sp
import cn.partialy.pm.lyric.LyricLine
import cn.partialy.pm.ui.player.lyricstyle.AccompanistLyricConfig
import com.mocharealm.accompanist.lyrics.core.model.SyncedLyrics
import com.mocharealm.accompanist.lyrics.core.model.karaoke.KaraokeAlignment
import com.mocharealm.accompanist.lyrics.core.model.karaoke.KaraokeLine
import com.mocharealm.accompanist.lyrics.core.model.karaoke.KaraokeSyllable
import com.mocharealm.accompanist.lyrics.core.model.synced.SyncedLine
import kotlinx.coroutines.isActive

internal class AccompanistLyricsHost(private val view: ComposeView, private val preview: Boolean = false) {
    private var document by mutableStateOf<SyncedLyrics?>(null)
    private var renderingEnabled by mutableStateOf(false)
    private var playbackRunning by mutableStateOf(false)
    private var positionMs by mutableIntStateOf(0)
    private var styleConfig by mutableStateOf(AccompanistLyricConfig())
    private var contentInstalled = false
    private var sourceLines: List<LyricLine>? = null
    private var useWordTiming = false

    var readPositionMs: (() -> Long)? = null
    var onSeek: ((Long) -> Unit)? = null

    fun bind(lines: List<LyricLine>?, useWordTiming: Boolean, config: AccompanistLyricConfig): Boolean {
        if (sourceLines !== lines || this.useWordTiming != useWordTiming) {
            sourceLines = lines
            this.useWordTiming = useWordTiming
            document = lines?.toAccompanistLyrics(useWordTiming)
        }
        styleConfig = config
        val hasLyrics = document != null
        view.visibility = if (hasLyrics) View.VISIBLE else View.GONE
        installContentIfActive()
        return hasLyrics
    }

    fun setRenderingActive(active: Boolean) {
        renderingEnabled = active
        installContentIfActive()
    }

    fun setPlaying(isPlaying: Boolean) {
        playbackRunning = isPlaying
    }

    fun updatePosition(position: Long) {
        positionMs = position.coerceIn(0L, Int.MAX_VALUE.toLong()).toInt()
    }

    fun release() {
        renderingEnabled = false
        readPositionMs = null
        onSeek = null
        if (contentInstalled) view.disposeComposition()
    }

    private fun installContentIfActive() {
        if (contentInstalled || !renderingEnabled || document == null) return
        contentInstalled = true
        view.setContent {
            val lyrics = document
            if (renderingEnabled && lyrics != null) {
                // 播放时按显示帧读毫秒进度。暂停后的拖动仍由宿主播放进度更新。
                LaunchedEffect(playbackRunning) {
                    if (playbackRunning) while (isActive) {
                        withFrameNanos { readPositionMs?.invoke()?.let(::updatePosition) }
                    }
                }
                key(lyrics) {
                    val config = styleConfig
                    val textStyle = TextStyle(
                        fontSize = (config.fontSizeSp * if (preview) 24f / 34f else 1f).sp,
                        fontWeight = if (config.bold) FontWeight.Bold else FontWeight.Normal,
                        textMotion = TextMotion.Animated,
                    )
                    AccompanistLyricsViewport(
                        lyrics = lyrics,
                        config = config,
                        textStyle = textStyle,
                        currentPosition = { positionMs },
                        onSeek = { onSeek?.invoke(it.toLong()) },
                    )
                }
            }
        }
    }
}

private fun List<LyricLine>.toAccompanistLyrics(useWordTiming: Boolean): SyncedLyrics? {
    val lines = mapNotNull { line ->
        val lineText = line.lineText
        if (lineText.isBlank()) return@mapNotNull null
        val start = line.startTime.coerceIn(0L, Int.MAX_VALUE.toLong() - 1).toInt()
        val end = line.endTime.coerceIn(start.toLong() + 1, Int.MAX_VALUE.toLong()).toInt()
        if (useWordTiming && line.hasWordTiming) {
            val syllables = line.words.map { word ->
                val wordStart = word.startTime.coerceIn(start.toLong(), end.toLong() - 1).toInt()
                val wordEnd = word.endTime.coerceIn(wordStart.toLong() + 1, end.toLong()).toInt()
                KaraokeSyllable(word.word, wordStart, wordEnd)
            }
            KaraokeLine.MainKaraokeLine(syllables, null, KaraokeAlignment.Unspecified, start, end)
        } else {
            SyncedLine(lineText, null, start, end)
        }
    }
    return if (lines.isEmpty()) null else SyncedLyrics(lines)
}
