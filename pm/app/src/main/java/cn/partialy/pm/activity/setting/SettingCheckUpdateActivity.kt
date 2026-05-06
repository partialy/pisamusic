package cn.partialy.pm.activity.setting

import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.model.UpdateInfo
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.utils.AppUpdateInstaller
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject

@AndroidEntryPoint
class SettingCheckUpdateActivity : BaseSettingWebActivity() {

    @Inject
    lateinit var configManager: ConfigManager

    private var pageReady = false
    private var localVersionName: String = ""
    private var latestInfo: UpdateInfo? = null
    private var hasNewVersion: Boolean = false
    private var lastManualCheckAtMs: Long = 0L
    private lateinit var appUpdateInstaller: AppUpdateInstaller

    override fun headerTitle(): String = getString(R.string.check_update)

    override fun initialUrl(): String {
        val isDark =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        return "file:///android_asset/setting/check_update.html?theme=${if (isDark) "dark" else "light"}"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        localVersionName = packageManager.getPackageInfo(packageName, 0).versionName.orEmpty()
        appUpdateInstaller = AppUpdateInstaller(
            activity = this,
            callbacks = object : AppUpdateInstaller.Callbacks {
                override fun onDownloadProgress(downloading: Boolean, progress: Int, text: String) {
                    notifyDownloadProgress(downloading, progress, text)
                }

                override fun onError(message: String) {
                    showPageError(message)
                }

                override fun onMessage(message: String) {
                    Toast.makeText(this@SettingCheckUpdateActivity, message, Toast.LENGTH_SHORT).show()
                }
            },
        )
        binding.webContentWebView.addJavascriptInterface(CheckUpdateBridge(), "AndroidUpdateHost")
        requestUpdateInfo(fromAuto = true, ignoreCooldown = true)
    }

    override fun onResume() {
        super.onResume()
        if (::appUpdateInstaller.isInitialized) {
            appUpdateInstaller.retryPendingInstall()
        }
    }

    override fun onDestroy() {
        if (::appUpdateInstaller.isInitialized) {
            appUpdateInstaller.destroy()
        }
        super.onDestroy()
    }

    override fun onWebViewPageFinished(url: String?) {
        pageReady = true
        renderPageState()
    }

    private fun renderPageState() {
        if (!pageReady) return
        val isDark =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        val info = latestInfo
        val payload = JSONObject().apply {
            put("localVersion", localVersionName)
            put("latestVersion", info?.latestVersion.orEmpty())
            put("updateTime", info?.updateTime.orEmpty())
            put("updateContent", info?.updateContent.orEmpty())
            put("downloadUrl", info?.downloadUrl.orEmpty())
            put("officialUrl", info?.officialUrl.orEmpty())
            put("hasData", info != null)
            put("hasNewVersion", hasNewVersion)
        }
        val js = """
            (function() {
              document.documentElement.classList.toggle('dark', ${if (isDark) "true" else "false"});
              if (window.PM_CHECK_UPDATE && typeof window.PM_CHECK_UPDATE.render === 'function') {
                window.PM_CHECK_UPDATE.render($payload);
              }
            })();
        """.trimIndent()
        binding.webContentWebView.evaluateJavascript(js, null)
    }

    private fun requestUpdateInfo(fromAuto: Boolean, ignoreCooldown: Boolean = false) {
        lifecycleScope.launch {
            if (!fromAuto && !ignoreCooldown) {
                val now = System.currentTimeMillis()
                val diff = now - lastManualCheckAtMs
                if (diff in 1 until COOLDOWN_MS) {
                    notifyCheckResult(
                        fromAuto = false,
                        checked = false,
                        message = "请稍后再试",
                        cooldownMs = (COOLDOWN_MS - diff).coerceAtLeast(0),
                    )
                    return@launch
                }
                lastManualCheckAtMs = now
            }

            val info = runCatching { configManager.getUpdateInfo() }.getOrElse {
                showPageError("更新信息获取失败")
                notifyCheckResult(fromAuto = fromAuto, checked = false, message = "更新信息获取失败", cooldownMs = 0)
                return@launch
            }

            latestInfo = info
            hasNewVersion = isVersionChanged(localVersionName, info.latestVersion)
            renderPageState()
            notifyCheckResult(
                fromAuto = fromAuto,
                checked = true,
                message = if (hasNewVersion) "发现新版本" else "已经是最新版本",
                cooldownMs = 0,
            )
        }
    }

    private fun notifyCheckResult(fromAuto: Boolean, checked: Boolean, message: String, cooldownMs: Long) {
        if (!pageReady) return
        val js = """
            window.PM_CHECK_UPDATE && window.PM_CHECK_UPDATE.onCheckResult({
              fromAuto: ${if (fromAuto) "true" else "false"},
              checked: ${if (checked) "true" else "false"},
              hasNewVersion: ${if (hasNewVersion) "true" else "false"},
              message: ${JSONObject.quote(message)},
              cooldownMs: $cooldownMs
            });
        """.trimIndent()
        binding.webContentWebView.evaluateJavascript(js, null)
    }

    private fun isVersionChanged(local: String, latest: String): Boolean {
        val a = local.trim().removePrefix("v").removePrefix("V")
        val b = latest.trim().removePrefix("v").removePrefix("V")
        if (a.isEmpty() || b.isEmpty()) return false
        return a != b
    }

    private fun showPageError(message: String) {
        if (!pageReady) {
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
            return
        }
        val msg = JSONObject.quote(message)
        binding.webContentWebView.evaluateJavascript(
            "window.PM_CHECK_UPDATE && window.PM_CHECK_UPDATE.setError($msg);",
            null,
        )
    }

    private inner class CheckUpdateBridge {
        @JavascriptInterface
        fun recheckUpdate() {
            runOnUiThread { requestUpdateInfo(fromAuto = false) }
        }

        @JavascriptInterface
        fun openUrl(url: String?) {
            val target = url?.trim().orEmpty()
            if (!(target.startsWith("http://") || target.startsWith("https://"))) return
            runOnUiThread {
                runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target)))
                }.onFailure {
                    Toast.makeText(this@SettingCheckUpdateActivity, "无法打开链接", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun openOfficial(url: String?) {
            openUrl(url)
        }

        @JavascriptInterface
        fun startDownload(url: String?) {
            runOnUiThread { startUpdateDownload(url) }
        }
    }

    private fun startUpdateDownload(rawUrl: String?) {
        appUpdateInstaller.startDownload(rawUrl)
    }

    private fun notifyDownloadProgress(downloading: Boolean, progress: Int, text: String) {
        if (!pageReady) return
        val safeText = JSONObject.quote(text)
        val js = """
            window.PM_CHECK_UPDATE && window.PM_CHECK_UPDATE.onDownloadProgress({
              downloading: ${if (downloading) "true" else "false"},
              progress: $progress,
              text: $safeText
            });
        """.trimIndent()
        binding.webContentWebView.evaluateJavascript(js, null)
    }

    companion object {
        private const val COOLDOWN_MS = 60_000L
    }
}

