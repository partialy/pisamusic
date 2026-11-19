package cn.partialy.pm.ui.player.lyricstyle

/**
 * 单个 KaraokeLyricsView 持有的渲染器集合，按样式 ID 分发并在销毁时统一释放离屏资源。
 */
internal class LyricEffectRendererRegistry(
    layoutEngine: KaraokeLyricLayoutEngine,
) {
    private val defaultRenderer = DefaultLyricLineRenderer(layoutEngine)
    private val typewriterRenderer = TypewriterLyricRenderer()
    private val inkRenderer = InkFlowLyricRenderer()
    private val bounceRenderer = BounceLyricRenderer()
    private val spotlightRenderer = SpotlightLyricRenderer()
    private val neonRenderer = NeonFlowLyricRenderer()
    private val oceanRenderer = OceanWaveLyricRenderer()

    fun get(styleId: LyricEffectStyleId): LyricEffectRenderer = when (styleId) {
        LyricEffectStyleId.DEFAULT -> defaultRenderer
        LyricEffectStyleId.TYPEWRITER -> typewriterRenderer
        LyricEffectStyleId.INK -> inkRenderer
        LyricEffectStyleId.BOUNCE -> bounceRenderer
        LyricEffectStyleId.SPOTLIGHT -> spotlightRenderer
        LyricEffectStyleId.NEON -> neonRenderer
        LyricEffectStyleId.OCEAN -> oceanRenderer
    }

    fun releaseAll() {
        defaultRenderer.release()
        typewriterRenderer.release()
        inkRenderer.release()
        bounceRenderer.release()
        spotlightRenderer.release()
        neonRenderer.release()
        oceanRenderer.release()
    }
}
