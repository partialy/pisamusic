package cn.partialy.pm.audioeffect

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.min
import kotlin.math.sign

class StereoWidenerAudioProcessor : BaseAudioProcessor() {
    @Volatile
    private var settings: StereoWidenerSettings = StereoWidenerSettings.DISABLED

    private var delayBuffer = FloatArray(1)
    private var delayIndex = 0
    private var lowSide = 0f
    private var lowPassAlpha = 0f

    fun updateSettings(next: StereoWidenerSettings) {
        settings = next.normalized()
        refreshFilterState()
    }

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT || inputAudioFormat.channelCount != 2) {
            return AudioProcessor.AudioFormat.NOT_SET
        }
        resizeDelayBuffer(inputAudioFormat.sampleRate)
        refreshFilterState()
        return inputAudioFormat
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val outputBuffer = replaceOutputBuffer(inputBuffer.remaining())
        val current = settings
        if (!current.enabled || !isWideningUseful(current)) {
            outputBuffer.put(inputBuffer)
            outputBuffer.flip()
            return
        }

        val input = inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
        val output = outputBuffer.order(ByteOrder.LITTLE_ENDIAN)
        val sideGain = current.stereoWidth / 100f
        val centerGain = current.centerRetention / 100f
        val protectRatio = if (current.bassMonoProtectHz > 0) 1f else 0f
        val preGain = 1f / (1f + (sideGain - 1f) * 0.38f)

        while (input.remaining() >= BYTES_PER_STEREO_FRAME) {
            val left = input.short / PCM_SHORT_SCALE
            val right = input.short / PCM_SHORT_SCALE
            val mid = ((left + right) * 0.5f) * centerGain
            val side = (left - right) * 0.5f
            val delayedSide = readDelayedSide(side)

            lowSide += lowPassAlpha * (side - lowSide)
            val highSide = delayedSide - lowSide
            val widenedSide = if (protectRatio > 0f) {
                lowSide + highSide * sideGain
            } else {
                delayedSide * sideGain
            }

            val outLeft = softLimit((mid + widenedSide) * preGain)
            val outRight = softLimit((mid - widenedSide) * preGain)
            output.putShort(floatToPcm(outLeft))
            output.putShort(floatToPcm(outRight))
        }

        output.flip()
    }

    override fun onFlush() {
        clearRuntimeState()
    }

    override fun onReset() {
        delayBuffer = FloatArray(1)
        clearRuntimeState()
    }

    private fun isWideningUseful(current: StereoWidenerSettings): Boolean =
        current.stereoWidth != AudioEffectState.STEREO_WIDTH_DEFAULT ||
            current.centerRetention != AudioEffectState.CENTER_RETENTION_DEFAULT ||
            current.spatialDelayUs > 0 ||
            current.bassMonoProtectHz > 0

    private fun readDelayedSide(side: Float): Float {
        if (delayBuffer.size <= 1) return side
        val delayed = delayBuffer[delayIndex]
        delayBuffer[delayIndex] = side
        delayIndex = (delayIndex + 1) % delayBuffer.size
        return side * DIRECT_SIDE_MIX + delayed * DELAYED_SIDE_MIX
    }

    private fun resizeDelayBuffer(sampleRate: Int) {
        val current = settings.normalized()
        val frames = ((sampleRate.toLong() * current.spatialDelayUs) / 1_000_000L)
            .toInt()
            .coerceAtLeast(1)
        if (delayBuffer.size != frames) {
            delayBuffer = FloatArray(frames)
            delayIndex = 0
        }
    }

    private fun refreshFilterState() {
        val sampleRate = inputAudioFormat.sampleRate
        if (sampleRate <= 0) return
        val cutoff = settings.bassMonoProtectHz
        lowPassAlpha = if (cutoff <= 0) {
            0f
        } else {
            val dt = 1.0 / sampleRate
            val rc = 1.0 / (2.0 * PI * cutoff)
            (dt / (rc + dt)).toFloat().coerceIn(0f, 1f)
        }
        resizeDelayBuffer(sampleRate)
    }

    private fun clearRuntimeState() {
        delayBuffer.fill(0f)
        delayIndex = 0
        lowSide = 0f
    }

    private fun softLimit(value: Float): Float {
        val magnitude = abs(value)
        if (magnitude <= SOFT_LIMIT_START) return value
        val over = magnitude - SOFT_LIMIT_START
        val compressed = SOFT_LIMIT_START + over / (1f + over * SOFT_LIMIT_RATIO)
        return sign(value) * min(compressed, 1f)
    }

    private fun floatToPcm(value: Float): Short {
        val clamped = value.coerceIn(-1f, 1f)
        return (clamped * if (clamped < 0f) 32768f else 32767f).toInt().toShort()
    }

    private companion object {
        private const val BYTES_PER_STEREO_FRAME = 4
        private const val PCM_SHORT_SCALE = 32768f
        private const val DIRECT_SIDE_MIX = 0.65f
        private const val DELAYED_SIDE_MIX = 0.35f
        private const val SOFT_LIMIT_START = 0.95f
        private const val SOFT_LIMIT_RATIO = 8f
    }
}
