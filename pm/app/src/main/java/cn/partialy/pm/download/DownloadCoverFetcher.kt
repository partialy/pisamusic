package cn.partialy.pm.download

import android.graphics.BitmapFactory
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.playlistdetail.requestablePlaylistCoverCandidates
import java.io.ByteArrayOutputStream
import okhttp3.OkHttpClient
import okhttp3.Request

/** 下载与缺图修复共用高清候选；失败不影响音频，拒绝 HTML 错误页和过大响应。 */
object DownloadCoverFetcher {
    private const val MAX_BYTES = 16 * 1024 * 1024

    @JvmStatic
    fun candidates(song: SongInfo): List<String> =
        requestablePlaylistCoverCandidates(song.type, song.coverUrl)

    @JvmStatic
    fun fetch(client: OkHttpClient, candidates: List<String>): ByteArray? {
        for (url in candidates) {
            val bytes = runCatching {
                client.newCall(Request.Builder().url(url).build()).execute().use response@{ response ->
                    if (!response.isSuccessful) return@response null
                    val body = response.body ?: return@response null
                    if (body.contentLength() > MAX_BYTES) return@response null
                    body.byteStream().use stream@{ stream ->
                        val output = ByteArrayOutputStream()
                        val buffer = ByteArray(8192)
                        while (true) {
                            val count = stream.read(buffer)
                            if (count < 0) break
                            if (output.size() + count > MAX_BYTES) return@stream null
                            output.write(buffer, 0, count)
                        }
                        output.toByteArray()
                    }
                }
            }.getOrNull() ?: continue
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            if (bounds.outWidth > 0 && bounds.outHeight > 0 &&
                bounds.outWidth.toLong() * bounds.outHeight <= 20_000_000L) return bytes
        }
        return null
    }
}
