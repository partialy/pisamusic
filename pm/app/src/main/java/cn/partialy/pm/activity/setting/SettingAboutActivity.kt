package cn.partialy.pm.activity.setting

import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.AppActivityTransitions
import cn.partialy.pm.model.AboutInfo
import cn.partialy.pm.network.config.ConfigManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject
import androidx.core.net.toUri

@AndroidEntryPoint
class SettingAboutActivity : BaseSettingWebActivity() {

    @Inject
    lateinit var configManager: ConfigManager

    private var pageReady = false
    private var aboutInfo: AboutInfo? = null
    private var localVersionName: String = ""

    override fun headerTitle(): String = getString(R.string.about)

    override fun initialUrl(): String {
        val isDark =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        return "file:///android_asset/setting/about.html?theme=${if (isDark) "dark" else "light"}"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        localVersionName = packageManager.getPackageInfo(packageName, 0).versionName.orEmpty()
        binding.webContentWebView.addJavascriptInterface(AboutBridge(), "AndroidAboutHost")

        lifecycleScope.launch {
            val about = runCatching { configManager.getAboutInfo() }.getOrElse {
                showPageError("关于信息获取失败")
                return@launch
            }
            aboutInfo = about
            renderPageState()
        }
    }

    override fun onWebViewPageFinished(url: String?) {
        pageReady = true
        renderPageState()
    }

    private fun renderPageState() {
        if (!pageReady) return
        val about = aboutInfo ?: return
        val payload = JSONObject().apply {
            put("appName", about.appName)
            put("websiteLabel", about.websiteLabel)
            put("websiteUrl", about.websiteUrl)
            put("description", about.description)
            put("team", about.team)
            put("copyright", about.copyright)
            put("versionName", localVersionName)
        }
        binding.webContentWebView.evaluateJavascript(
            "window.PM_ABOUT && window.PM_ABOUT.render($payload);",
            null,
        )
    }

    private fun showPageError(message: String) {
        if (!pageReady) {
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
            return
        }
        val msg = JSONObject.quote(message)
        binding.webContentWebView.evaluateJavascript(
            "window.PM_ABOUT && window.PM_ABOUT.setError($msg);",
            null,
        )
    }

    private inner class AboutBridge {
        @JavascriptInterface
        fun openCheckUpdate() {
            runOnUiThread {
                startActivity(Intent(this@SettingAboutActivity, SettingCheckUpdateActivity::class.java))
                AppActivityTransitions.applyForward(this@SettingAboutActivity)
            }
        }

        @JavascriptInterface
        fun openServiceAgreement() {
            runOnUiThread {
                startActivity(Intent(this@SettingAboutActivity, SettingServiceAgreementActivity::class.java))
                AppActivityTransitions.applyForward(this@SettingAboutActivity)
            }
        }

        @JavascriptInterface
        fun openPrivacyPolicy() {
            runOnUiThread {
                startActivity(Intent(this@SettingAboutActivity, SettingPrivacyPolicyActivity::class.java))
                AppActivityTransitions.applyForward(this@SettingAboutActivity)
            }
        }

        @JavascriptInterface
        fun openContactUs() {
            runOnUiThread {
                startActivity(Intent(this@SettingAboutActivity, SettingContactUsActivity::class.java))
                AppActivityTransitions.applyForward(this@SettingAboutActivity)
            }
        }

        @JavascriptInterface
        fun openUrl(url: String?) {
            val target = url?.trim().orEmpty()
            if (!(target.startsWith("http://") || target.startsWith("https://"))) return
            runOnUiThread {
                runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW, target.toUri()))
                }.onFailure {
                    Toast.makeText(this@SettingAboutActivity, "无法打开链接", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}

