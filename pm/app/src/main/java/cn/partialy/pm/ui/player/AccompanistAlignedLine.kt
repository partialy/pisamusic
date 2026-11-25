package cn.partialy.pm.ui.player

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import cn.partialy.pm.ui.player.lyricstyle.AccompanistLyricAlignment
import com.mocharealm.accompanist.lyrics.core.model.ISyncedLine
import com.mocharealm.accompanist.lyrics.core.model.karaoke.KaraokeLine
import com.mocharealm.accompanist.lyrics.core.model.synced.SyncedLine
import com.mocharealm.accompanist.lyrics.ui.composable.lyrics.calculateBalancedLines
import com.mocharealm.accompanist.lyrics.ui.composable.lyrics.calculateRowRenderData
import com.mocharealm.accompanist.lyrics.ui.composable.lyrics.calculateStaticLineLayout
import com.mocharealm.accompanist.lyrics.ui.composable.lyrics.drawLyricsLine
import com.mocharealm.accompanist.lyrics.ui.composable.lyrics.measureSyllablesAndDetermineAnimation
import com.mocharealm.accompanist.lyrics.ui.utils.isRtl
import kotlin.math.roundToInt

@Composable
internal fun AccompanistAlignedLine(
    line: ISyncedLine,
    alignment: AccompanistLyricAlignment,
    textStyle: TextStyle,
    measurer: TextMeasurer,
    color: Color,
    blendMode: BlendMode,
    currentPosition: () -> Int,
) {
    when (line) {
        is SyncedLine -> BasicText(
            text = line.content,
            style = textStyle.copy(color = color, lineHeight = 1.2.em, textAlign = when (alignment) {
                AccompanistLyricAlignment.LEFT -> TextAlign.Left
                AccompanistLyricAlignment.CENTER -> TextAlign.Center
                AccompanistLyricAlignment.RIGHT -> TextAlign.Right
            }),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        )

        is KaraokeLine -> BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
            val width = constraints.maxWidth.toFloat()
            if (width <= 0f) return@BoxWithConstraints
            val density = LocalDensity.current
            val style = textStyle.copy(textDirection = TextDirection.Content)
            val isRtl = remember(line) { line.syllables.any { it.content.isRtl() } }
            val (rows, height) = remember(line, style, density, width, alignment, measurer) {
                val measured = measureSyllablesAndDetermineAnimation(
                    syllables = line.syllables,
                    textMeasurer = measurer,
                    style = style,
                    phoneticStyle = style,
                    isAccompanimentLine = line is KaraokeLine.AccompanimentKaraokeLine,
                    spaceWidth = measurer.measure(" ", style).size.width.toFloat(),
                )
                val wrapped = calculateBalancedLines(measured, width, measurer, style)
                val lineHeight = measurer.measure("M", style).size.height.toFloat()
                val positioned = calculateStaticLineLayout(
                    wrappedLines = wrapped,
                    isLineRightAligned = alignment == AccompanistLyricAlignment.RIGHT,
                    canvasWidth = width,
                    lineHeight = lineHeight,
                    phoneticHeight = 0f,
                    isRtl = isRtl,
                )
                val aligned = if (alignment == AccompanistLyricAlignment.CENTER) {
                    positioned.mapIndexed { index, row ->
                        val shift = Offset((width - wrapped[index].totalWidth) / 2f, 0f)
                        row.map { it.copy(position = it.position + shift, wordPivot = it.wordPivot + shift) }
                    }
                } else {
                    positioned
                }
                val height = (lineHeight * wrapped.size).roundToInt() + 8
                calculateRowRenderData(aligned, showPhonetic = false, density = density.density) to height
            }
            Canvas(Modifier.fillMaxWidth().height(with(density) { height.toDp() })) {
                drawLyricsLine(rows, currentPosition(), color, blendMode, isRtl, showPhonetic = false)
            }
        }

        else -> Unit
    }
}
