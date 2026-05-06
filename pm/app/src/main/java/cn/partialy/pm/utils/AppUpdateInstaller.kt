package cn.partialy.pm.utils

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class AppUpdateInstaller(
    private val activity: AppCompatActivity,
    private val callbacks: Callbacks,
) {
    interface Callbacks {
        fun onDownloadProgress(downloading: Boolean, progress: Int, text: String)
        fun onError(message: String)
        fun onMessage(message: String) = Unit
    }

    private var pendingDownloadId: Long = -1L
    private var downloadReceiverRegistered = false
    private var downloadProgressJob: Job? = null
    private var pendingInstallUri: Uri? = null

    fun startDownload(rawUrl: String?) {
        pendingInstallUri?.let {
            installOrRequestPermission(it)
            return
        }

        if (pendingDownloadId > 0L) {
            callbacks.onDownloadProgress(true, -1, "下载中...")
            return
        }

        val url = rawUrl?.trim().orEmpty()
        if (!(url.startsWith("http://") || url.startsWith("https://"))) {
            callbacks.onError("下载地址无效")
            return
        }

        ensureDownloadReceiverRegistered()

        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("PisaMusic 更新下载")
            .setDescription("正在下载最新版本")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setMimeType(APK_MIME_TYPE)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val dm = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        pendingDownloadId = runCatching { dm.enqueue(request) }.getOrElse {
            callbacks.onError("下载启动失败：${it.message ?: "未知错误"}")
            return
        }

        startDownloadProgressPolling()
        callbacks.onDownloadProgress(true, 0, "开始下载...")
        callbacks.onMessage("开始下载更新包")
    }

    fun retryPendingInstall() {
        val uri = pendingInstallUri ?: return
        if (canRequestPackageInstalls()) {
            pendingInstallUri = null
            openPackageInstaller(uri)
        }
    }

    fun destroy() {
        downloadProgressJob?.cancel()
        downloadProgressJob = null
        if (downloadReceiverRegistered) {
            activity.unregisterReceiver(downloadReceiver)
            downloadReceiverRegistered = false
        }
    }

    private fun ensureDownloadReceiverRegistered() {
        if (downloadReceiverRegistered) return
        ContextCompat.registerReceiver(
            activity,
            downloadReceiver,
            IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED,
        )
        downloadReceiverRegistered = true
    }

    private val downloadReceiver: BroadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
            val downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
            if (downloadId <= 0L || downloadId != pendingDownloadId) return
            handleDownloadComplete(downloadId)
        }
    }

    private fun handleDownloadComplete(downloadId: Long) {
        val dm = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val snapshot = queryDownload(downloadId)
        pendingDownloadId = -1L
        downloadProgressJob?.cancel()

        if (snapshot?.status != DownloadManager.STATUS_SUCCESSFUL) {
            callbacks.onDownloadProgress(false, -1, "下载失败")
            callbacks.onError("下载失败，请稍后重试")
            return
        }

        val uri = dm.getUriForDownloadedFile(downloadId)
        if (uri == null) {
            callbacks.onDownloadProgress(false, -1, "下载完成，但无法安装")
            callbacks.onError("下载完成，但无法获取安装包，请手动安装")
            return
        }

        callbacks.onDownloadProgress(false, 100, "下载完成，准备安装")
        installOrRequestPermission(uri)
    }

    private fun startDownloadProgressPolling() {
        downloadProgressJob?.cancel()
        downloadProgressJob = activity.lifecycleScope.launch {
            while (pendingDownloadId > 0L) {
                val snapshot = queryDownload(pendingDownloadId)
                if (snapshot != null) {
                    val progress = if (snapshot.total > 0L) {
                        ((snapshot.downloaded * 100) / snapshot.total).toInt().coerceIn(0, 100)
                    } else {
                        -1
                    }
                    when (snapshot.status) {
                        DownloadManager.STATUS_RUNNING,
                        DownloadManager.STATUS_PENDING,
                        DownloadManager.STATUS_PAUSED -> {
                            callbacks.onDownloadProgress(
                                true,
                                progress,
                                if (progress >= 0) "下载中 ${progress}%" else "下载中...",
                            )
                        }
                        DownloadManager.STATUS_FAILED -> {
                            pendingDownloadId = -1L
                            callbacks.onDownloadProgress(false, -1, "下载失败")
                            callbacks.onError("下载失败，请稍后重试")
                        }
                    }
                }
                delay(500)
            }
        }
    }

    private fun queryDownload(downloadId: Long): DownloadSnapshot? {
        val dm = activity.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val query = DownloadManager.Query().setFilterById(downloadId)
        return runCatching {
            dm.query(query).use { cursor ->
                if (!cursor.moveToFirst()) return@use null
                DownloadSnapshot(
                    status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)),
                    total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)),
                    downloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)),
                )
            }
        }.getOrNull()
    }

    private fun installOrRequestPermission(uri: Uri) {
        if (canRequestPackageInstalls()) {
            openPackageInstaller(uri)
            return
        }

        pendingInstallUri = uri
        callbacks.onDownloadProgress(false, 100, "请允许安装未知应用后返回继续安装")
        callbacks.onMessage("请允许安装未知应用后返回继续安装")
        val settingsIntent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${activity.packageName}"),
        )
        runCatching { activity.startActivity(settingsIntent) }
            .onFailure {
                callbacks.onError("无法打开安装权限设置：${it.message ?: "未知错误"}")
            }
    }

    private fun canRequestPackageInstalls(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            activity.packageManager.canRequestPackageInstalls()
    }

    private fun openPackageInstaller(uri: Uri) {
        val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
            setDataAndType(uri, APK_MIME_TYPE)
            putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        runCatching { activity.startActivity(installIntent) }
            .onFailure {
                callbacks.onError("无法打开安装界面：${it.message ?: "未知错误"}，请手动安装")
            }
    }

    private data class DownloadSnapshot(
        val status: Int,
        val total: Long,
        val downloaded: Long,
    )

    companion object {
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
    }
}
