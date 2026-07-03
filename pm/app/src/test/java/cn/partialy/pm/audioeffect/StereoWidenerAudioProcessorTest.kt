package cn.partialy.pm.audioeffect

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import java.nio.ByteBuffer
import java.nio.ByteOrder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StereoWidenerAudioProcessorTest {
    @Test
    fun `bypasses disabled stereo pcm`() {
        val processor = StereoWidenerAudioProcessor()
        processor.configure(stereoPcmFormat())
        processor.flush()

        val input = stereoBuffer(1000, -1000, -2000, 2000)
        processor.queueInput(input)
        val output = processor.getOutput().order(ByteOrder.LITTLE_ENDIAN)

        assertEquals(1000, output.short.toInt())
        assertEquals(-1000, output.short.toInt())
        assertEquals(-2000, output.short.toInt())
        assertEquals(2000, output.short.toInt())
    }

    @Test
    fun `bypass accepts previous output buffer as next input`() {
        val processor = StereoWidenerAudioProcessor()
        processor.configure(stereoPcmFormat())
        processor.flush()

        processor.queueInput(stereoBuffer(1000, -1000, -2000, 2000))
        val previousOutput = processor.getOutput()

        processor.queueInput(previousOutput)
        val output = processor.getOutput().order(ByteOrder.LITTLE_ENDIAN)

        assertEquals(1000, output.short.toInt())
        assertEquals(-1000, output.short.toInt())
        assertEquals(-2000, output.short.toInt())
        assertEquals(2000, output.short.toInt())
    }

    @Test
    fun `widens stereo pcm without clipping`() {
        val processor = StereoWidenerAudioProcessor()
        processor.updateSettings(
            StereoWidenerSettings(
                enabled = true,
                stereoWidth = 180,
                centerRetention = 85,
                spatialDelayUs = 500,
                bassMonoProtectHz = 180,
            ),
        )
        processor.configure(stereoPcmFormat())
        processor.flush()

        val input = stereoBuffer(12000, -12000, 16000, -16000, -18000, 18000)
        processor.queueInput(input)
        val output = processor.getOutput().order(ByteOrder.LITTLE_ENDIAN)

        var changed = false
        while (output.remaining() >= 2) {
            val sample = output.short.toInt()
            changed = changed || sample != 12000
            assertTrue(sample in Short.MIN_VALUE..Short.MAX_VALUE)
        }
        assertTrue(changed)
    }

    @Test
    fun `bypasses mono pcm by becoming inactive`() {
        val processor = StereoWidenerAudioProcessor()

        val outputFormat = processor.configure(AudioProcessor.AudioFormat(44100, 1, C.ENCODING_PCM_16BIT))

        assertEquals(AudioProcessor.AudioFormat.NOT_SET, outputFormat)
        assertEquals(false, processor.isActive)
    }

    @Test
    fun `silent input remains silent`() {
        val processor = StereoWidenerAudioProcessor()
        processor.updateSettings(StereoWidenerSettings(enabled = true, stereoWidth = 160))
        processor.configure(stereoPcmFormat())
        processor.flush()

        processor.queueInput(stereoBuffer(0, 0, 0, 0))
        val output = processor.getOutput().order(ByteOrder.LITTLE_ENDIAN)

        assertEquals(0, output.short.toInt())
        assertEquals(0, output.short.toInt())
        assertEquals(0, output.short.toInt())
        assertEquals(0, output.short.toInt())
    }

    private fun stereoPcmFormat(): AudioProcessor.AudioFormat =
        AudioProcessor.AudioFormat(44100, 2, C.ENCODING_PCM_16BIT)

    private fun stereoBuffer(vararg samples: Short): ByteBuffer {
        val buffer = ByteBuffer.allocateDirect(samples.size * 2).order(ByteOrder.LITTLE_ENDIAN)
        samples.forEach { buffer.putShort(it) }
        buffer.flip()
        return buffer
    }

    private fun stereoBuffer(vararg samples: Int): ByteBuffer =
        stereoBuffer(*samples.map { it.toShort() }.toShortArray())
}
