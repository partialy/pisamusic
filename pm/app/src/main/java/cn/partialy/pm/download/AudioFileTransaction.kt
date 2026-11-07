package cn.partialy.pm.download

import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.UUID

/** 文件修复只在同目录副本上修改，异常恢复仅扫描事务日志。 */
object AudioFileTransaction {
    private const val TAG = "AudioFileTransaction"
    private const val JOURNAL_SUFFIX = ".pm-repair-journal"

    fun replace(original: File, transform: (File) -> Unit, verify: (File) -> Boolean) = DownloadFileLocks.withFile(original) {
        require(original.isFile && original.length() > 0L) { "音频文件不存在" }
        val parent = original.parentFile ?: error("文件没有所在目录")
        val reserve = original.length() + maxOf(8L * 1024 * 1024, original.length() / 10L)
        require(parent.usableSpace > reserve) { "可用空间不足，无法安全修复" }
        val token = UUID.randomUUID().toString().replace("-", "")
        val stage = File(parent, ".${original.nameWithoutExtension}.repair-$token.${original.extension}")
        val backup = File(parent, ".${original.name}.backup-$token")
        val journal = File(parent, ".$token$JOURNAL_SUFFIX")
        var journalCreated = false
        try {
            Files.copy(original.toPath(), stage.toPath())
            transform(stage)
            require(verify(stage)) { "修改后的标签验证失败" }
            FileOutputStream(journal).use { output ->
                output.write(listOf(original.absolutePath, stage.absolutePath, backup.absolutePath)
                    .joinToString("\n").toByteArray(Charsets.UTF_8))
                output.fd.sync()
            }
            journalCreated = true
            move(original, backup)
            try {
                move(stage, original)
                require(verify(original)) { "替换后校验失败" }
                if (!backup.delete()) Log.w(TAG, "Backup cleanup deferred: ${backup.name}")
            } catch (error: Exception) {
                if (backup.isFile) move(backup, original)
                throw error
            }
        } finally {
            // 回滚失败时保留日志与备份，下次启动恢复。
            if (backup.exists()) {
                Log.w(TAG, "Pending repair recovery: ${original.name}")
            } else {
                if (stage.exists()) stage.delete()
                if (journalCreated || journal.exists()) journal.delete()
            }
        }
    }

    fun recoverPending(directory: File) {
        directory.listFiles { f -> f.isFile && f.name.endsWith(JOURNAL_SUFFIX) }
            .orEmpty().forEach { journal ->
                runCatching {
                    val lines = journal.readLines(Charsets.UTF_8)
                    require(lines.size == 3) { "事务日志损坏" }
                    val (original, stage, backup) = lines.map(::File)
                    require(original.parentFile?.canonicalFile == directory.canonicalFile) { "原文件路径错误" }
                    require(stage.parentFile?.canonicalFile == directory.canonicalFile) { "暂存路径错误" }
                    require(backup.parentFile?.canonicalFile == directory.canonicalFile) { "备份路径错误" }
                    if (backup.isFile) move(backup, original)
                    check(original.isFile) { "音频文件缺失，保留恢复日志" }
                    if (stage.exists()) stage.delete()
                    journal.delete()
                }.onFailure { Log.e(TAG, "Recover failed: ${journal.name}", it) }
            }
    }

    private fun move(from: File, to: File) {
        try {
            Files.move(from.toPath(), to.toPath(),
                StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(from.toPath(), to.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }
}
