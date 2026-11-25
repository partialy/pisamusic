package cn.partialy.pm.ui.player

import android.os.Build
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.BlurEffect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.LookaheadScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import cn.partialy.pm.ui.player.lyricstyle.AccompanistLyricAlignment
import cn.partialy.pm.ui.player.lyricstyle.AccompanistLyricConfig
import cn.partialy.pm.ui.player.lyricstyle.AccompanistLyricPosition
import com.mocharealm.accompanist.lyrics.core.model.SyncedLyrics
import com.mocharealm.accompanist.lyrics.core.model.karaoke.KaraokeAlignment
import com.mocharealm.accompanist.lyrics.ui.composable.lyrics.KaraokeBreathingDots
import com.mocharealm.accompanist.lyrics.ui.composable.lyrics.KaraokeBreathingDotsDefaults
import com.mocharealm.accompanist.lyrics.ui.utils.modifier.springPlacement
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlin.math.roundToInt

@Composable
internal fun AccompanistLyricsViewport(
    lyrics: SyncedLyrics,
    config: AccompanistLyricConfig,
    textStyle: TextStyle,
    currentPosition: () -> Int,
    onSeek: (Int) -> Unit,
) {
    val readPosition by rememberUpdatedState(currentPosition)
    val focus by remember(lyrics) {
        derivedStateOf {
            val time = readPosition()
            val index = lyrics.getCurrentFirstHighlightLineIndexByTime(time).coerceIn(lyrics.lines.indices)
            val start = lyrics.lines[index].start
            val previousEnd = lyrics.lines.getOrNull(index - 1)?.end ?: 0
            val interlude = if (start - previousEnd > 5_000 && time in previousEnd until start) {
                previousEnd until start
            } else {
                null
            }
            AccompanistFocus(index, lyrics.getCurrentAllHighlightLineIndicesByTime(time), interlude)
        }
    }
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = focus.index)
    val dragged by listState.interactionSource.collectIsDraggedAsState()
    var browsing by remember { mutableStateOf(false) }
    LaunchedEffect(dragged) {
        if (dragged) {
            browsing = true
        } else if (browsing) {
            snapshotFlow { listState.isScrollInProgress }.first { !it }
            delay(2_500)
            browsing = false
        }
    }

    val textMeasurer = rememberTextMeasurer(cacheSize = 96)
    val textColor = Color(config.textColorArgb)
    val blendMode = if (config.additiveBlend) BlendMode.Plus else BlendMode.SrcOver
    val blur = config.blurEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val dots = KaraokeBreathingDotsDefaults(
        number = config.dotsCount,
        size = config.dotsSizeDp.dp,
        margin = config.dotsSpacingDp.dp,
        breathingDotsColor = Color(config.dotsColorArgb),
    )

    BoxWithConstraints(Modifier.fillMaxSize().clipToBounds()) {
        val heightPx = constraints.maxHeight
        if (heightPx <= 0) return@BoxWithConstraints
        val leadingPx = (heightPx * config.position.fraction).roundToInt().coerceAtMost(heightPx - 1)
        val contentPadding = with(LocalDensity.current) {
            PaddingValues(top = leadingPx.toDp(), bottom = (heightPx - leadingPx - 1).toDp())
        }
        LaunchedEffect(focus.index, config.position, heightPx, browsing, dragged) {
            if (browsing || dragged) return@LaunchedEffect
            val layout = snapshotFlow { listState.layoutInfo }.first {
                it.viewportSize.height == heightPx && it.beforeContentPadding == leadingPx
            }
            val index = focus.index
            if (layout.visibleItemsInfo.none { it.index == index }) listState.animateScrollToItem(index)
            // 用实际项目高度定位，长歌词折行后仍以整条歌词为基准。
            snapshotFlow { listState.layoutInfo.visibleItemsInfo.firstOrNull { it.index == index }?.size }
                .filterNotNull()
                .collect { rowHeight ->
                    val info = listState.layoutInfo
                    val item = info.visibleItemsInfo.firstOrNull { it.index == index } ?: return@collect
                    val desiredTop = ((heightPx - rowHeight).coerceAtLeast(0) * config.position.fraction).roundToInt()
                    val delta = item.offset - info.viewportStartOffset - desiredTop
                    if (delta != 0) listState.scrollBy(delta.toFloat())
                }
        }

        LookaheadScope {
            LazyColumn(
                state = listState,
                contentPadding = contentPadding,
                modifier = Modifier.fillMaxSize().accompanistEdgeFade(config.position),
            ) {
                itemsIndexed(lyrics.lines, key = { index, _ -> index }) { index, line ->
                    val active = index in focus.active
                    val firstActive = focus.active.firstOrNull() ?: focus.index
                    val lastActive = focus.active.lastOrNull() ?: focus.index
                    val distance = maxOf(firstActive - index, index - lastActive, 0)
                    val blurRadius by animateFloatAsState(
                        targetValue = if (blur && !dragged) distance * config.blurStrength.toFloat() else 0f,
                        animationSpec = tween(300),
                        label = "lyric blur",
                    )
                    Column(Modifier.springPlacement(
                        lookaheadScope = this@LookaheadScope,
                        itemKey = index,
                        isManualScrolling = dragged || browsing,
                        stiffness = (120f - distance * 20f).coerceAtLeast(20f),
                    )) {
                        val interlude = focus.interlude
                        if (index == focus.index && interlude != null && config.dotsCount > 0) {
                            Box(Modifier.fillMaxWidth(), contentAlignment = config.alignment.dotsAlignment()) {
                                KaraokeBreathingDots(
                                    alignment = KaraokeAlignment.Unspecified,
                                    startTimeMs = interlude.first,
                                    endTimeMs = line.start,
                                    currentTimeProvider = { readPosition() },
                                    modifier = Modifier.padding(vertical = 12.dp),
                                    defaults = dots,
                                )
                            }
                        }
                        AccompanistFocusRow(
                            focused = active,
                            alignment = config.alignment,
                            onClick = {
                                browsing = false
                                onSeek(line.start)
                            },
                            blurRadius = { blurRadius },
                            blendMode = blendMode,
                        ) {
                            AccompanistAlignedLine(
                                line, config.alignment, textStyle, textMeasurer, textColor, blendMode, { readPosition() },
                            )
                        }
                    }
                }
            }
        }
    }
}

private data class AccompanistFocus(val index: Int, val active: List<Int>, val interlude: IntRange?)

@Composable
private fun AccompanistFocusRow(
    focused: Boolean,
    alignment: AccompanistLyricAlignment,
    onClick: () -> Unit,
    blurRadius: () -> Float,
    blendMode: BlendMode,
    content: @Composable () -> Unit,
) {
    val alpha by animateFloatAsState(if (focused) 1f else 0.4f, label = "lyric opacity")
    val scale by animateFloatAsState(
        targetValue = if (focused) 1f else 0.98f,
        animationSpec = if (focused) tween(600, easing = LinearOutSlowInEasing) else tween(300, easing = EaseInOut),
        label = "lyric scale",
    )
    val horizontalPivot = when (alignment) {
        AccompanistLyricAlignment.LEFT -> 0f
        AccompanistLyricAlignment.CENTER -> 0.5f
        AccompanistLyricAlignment.RIGHT -> 1f
    }
    Box(Modifier.fillMaxWidth().graphicsLayer {
        this.alpha = alpha
        scaleX = scale
        scaleY = scale
        transformOrigin = TransformOrigin(horizontalPivot, 1f)
        this.blendMode = blendMode
        compositingStrategy = CompositingStrategy.Offscreen
        val radius = blurRadius()
        renderEffect = if (radius > 0f) BlurEffect(radius, radius, TileMode.Clamp) else null
    }.clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick)) {
        content()
    }
}

private fun AccompanistLyricAlignment.dotsAlignment(): Alignment = when (this) {
    AccompanistLyricAlignment.LEFT -> AbsoluteAlignment.CenterLeft
    AccompanistLyricAlignment.CENTER -> Alignment.Center
    AccompanistLyricAlignment.RIGHT -> AbsoluteAlignment.CenterRight
}

private fun Modifier.accompanistEdgeFade(position: AccompanistLyricPosition): Modifier =
    graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }.drawWithCache {
        val top = if (position == AccompanistLyricPosition.TOP) 0f else (20.dp.toPx() / size.height).coerceAtMost(0.3f)
        val bottom = if (position == AccompanistLyricPosition.BOTTOM) 0f else (100.dp.toPx() / size.height).coerceAtMost(0.4f)
        val mask = Brush.verticalGradient(
            0f to if (top == 0f) Color.White else Color.Transparent,
            top to Color.White,
            (1f - bottom) to Color.White,
            1f to if (bottom == 0f) Color.White else Color.Transparent,
        )
        onDrawWithContent {
            drawContent()
            drawRect(brush = mask, blendMode = BlendMode.DstIn)
        }
    }
