package cn.partialy.pm.audioeffect

import android.content.Context
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink

@UnstableApi
class AudioEffectsRenderersFactory(
    context: Context,
    private val stereoWidenerAudioProcessor: StereoWidenerAudioProcessor,
) : DefaultRenderersFactory(context) {
    override fun buildAudioSink(
        context: Context,
        enableFloatOutput: Boolean,
        enableAudioTrackPlaybackParams: Boolean,
    ): AudioSink =
        DefaultAudioSink.Builder(context)
            .setAudioProcessors(arrayOf<AudioProcessor>(stereoWidenerAudioProcessor))
            .setEnableFloatOutput(enableFloatOutput)
            .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
            .build()
}
