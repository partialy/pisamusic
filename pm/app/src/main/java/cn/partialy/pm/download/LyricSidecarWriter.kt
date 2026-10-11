package cn.partialy.pm.download

import java.io.File
import java.nio.charset.StandardCharsets
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption

enum class LyricSidecarStatus {
    DISABLED,
    SAVED,
    NOT_FOUND,
    FAILED,
}

data class LyricSidecarWriteResult(
    val status: LyricSidecarStatus,
    val savedCount: Int = 0,
    val savedPaths: List<String> = emptyList(),
)

object LyricSidecarWriter {
    fun write(audioFile: File, lyrics: ResolvedDownloadLyrics): LyricSidecarWriteResult {
        if (!lyrics.sidecarsRequested) return LyricSidecarWriteResult(LyricSidecarStatus.DISABLED)
        if (lyrics.sidecars.isEmpty()) return LyricSidecarWriteResult(LyricSidecarStatus.NOT_FOUND)

        val savedPaths = mutableListOf<String>()
        var failed = false
        lyrics.sidecars.forEach { asset ->
            val result = runCatching { writeAsset(audioFile, asset) }
            result.onSuccess { savedPaths += it.absolutePath }
                .onFailure { failed = true }
        }
        return LyricSidecarWriteResult(
            status = if (failed) LyricSidecarStatus.FAILED else LyricSidecarStatus.SAVED,
            savedCount = savedPaths.size,
            savedPaths = savedPaths,
        )
    }

    private fun writeAsset(audioFile: File, asset: DownloadLyricAsset): File {
        val parent = audioFile.parentFile ?: error("音频文件没有父目录")
        if (!parent.exists() && !parent.mkdirs()) error("无法创建歌词目录")
        val target = File(parent, "${audioFile.nameWithoutExtension}.${asset.extension}")
        val temp = File(parent, ".${target.name}.${System.nanoTime()}.part")
        try {
            temp.outputStream().bufferedWriter(StandardCharsets.UTF_8).use { writer ->
                writer.write(asset.text)
            }
            try {
                Files.move(
                    temp.toPath(),
                    target.toPath(),
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING,
                )
            } catch (_: AtomicMoveNotSupportedException) {
                Files.move(temp.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
            return target
        } finally {
            if (temp.exists()) temp.delete()
        }
    }
}
