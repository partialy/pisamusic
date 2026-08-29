package cn.partialy.pm.network.cloudmusic

import android.content.ContentResolver
import android.net.Uri
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import okhttp3.MediaType
import okhttp3.RequestBody
import okio.BufferedSink

/** 每次写入都重新打开 Content URI，避免把音频整体读入内存。 */
class CloudMusicUploadRequestBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val size: Long,
    private val mediaType: MediaType?,
    private val isCallCanceled: () -> Boolean = { false },
    private val onProgress: (Int) -> Unit = {},
) : RequestBody() {
    private val cancellationRequested = AtomicBoolean(false)
    private val activeInput = AtomicReference<InputStream?>()

    override fun contentType(): MediaType? = mediaType

    override fun contentLength(): Long = size

    override fun writeTo(sink: BufferedSink) {
        ensureActive()
        onProgress(0)

        val input = contentResolver.openInputStream(uri)
            ?: throw IOException("无法打开所选文件")
        if (!activeInput.compareAndSet(null, input)) {
            input.close()
            throw IOException("所选文件正在上传")
        }

        try {
            val buffer = ByteArray(BUFFER_SIZE)
            var written = 0L
            var lastProgress = 0
            while (true) {
                ensureActive()
                val read = input.read(buffer)
                if (read < 0) break
                if (read == 0) continue
                ensureActive()
                sink.write(buffer, 0, read)
                written += read

                val progress = ((written.toDouble() / size.toDouble()) * 100.0)
                    .toInt()
                    .coerceIn(0, 100)
                if (progress != lastProgress) {
                    lastProgress = progress
                    onProgress(progress)
                }
            }
            ensureActive()
            if (written != size) {
                throw IOException("所选文件大小已变化，请重新选择")
            }
            if (lastProgress < 100) onProgress(100)
        } finally {
            activeInput.compareAndSet(input, null)
            input.close()
        }
    }

    /** 协程取消时关闭正在读取的 Content URI，使阻塞中的 read 尽快退出。 */
    fun cancel() {
        cancellationRequested.set(true)
        runCatching { activeInput.getAndSet(null)?.close() }
    }

    private fun ensureActive() {
        if (cancellationRequested.get() || isCallCanceled()) {
            throw IOException("七牛直传已取消")
        }
    }

    private companion object {
        const val BUFFER_SIZE = 32 * 1024
    }
}
