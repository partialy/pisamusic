package cn.partialy.pm.activity.setting

import android.content.res.Configuration
import android.os.Bundle
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.network.config.ConfigManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject

@AndroidEntryPoint
class SettingContactUsActivity : BaseSettingWebActivity() {

    @Inject
    lateinit var configManager: ConfigManager

    private var pageReady = false
    private var htmlContent: String? = null

    override fun headerTitle(): String = "联系我们"

    override fun initialUrl(): String {
        val isDark =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        return "file:///android_asset/setting/policy.html?theme=${if (isDark) "dark" else "light"}"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            htmlContent = runCatching {
                configManager.getDynamicConfigInfo(CONTACT_CONFIG_ID).content
            }.getOrElse {
                showPageError("联系我们信息获取失败")
                return@launch
            }
            render()
        }
    }

    override fun onWebViewPageFinished(url: String?) {
        pageReady = true
        render()
    }

    private fun render() {
        if (!pageReady) return
        val content = htmlContent ?: return
        val json = JSONObject().apply {
            put("content", content)
        }
        binding.webContentWebView.evaluateJavascript(
            "window.PM_POLICY && window.PM_POLICY.render($json);",
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
            "window.PM_POLICY && window.PM_POLICY.setError($msg);",
            null,
        )
    }

    companion object {
        private const val CONTACT_CONFIG_ID = "pm-contact-us"
    }
}
