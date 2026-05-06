package cn.partialy.pm.activity.setting

import android.content.res.Configuration
import android.os.Bundle
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.model.AgreementInfo
import cn.partialy.pm.network.config.ConfigManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject

@AndroidEntryPoint
class SettingServiceAgreementActivity : BaseSettingWebActivity() {

    @Inject
    lateinit var configManager: ConfigManager

    private var pageReady = false
    private var payload: AgreementInfo? = null

    override fun headerTitle(): String = "服务协议"

    override fun initialUrl(): String {
        val isDark =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        return "file:///android_asset/setting/policy.html?theme=${if (isDark) "dark" else "light"}"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            payload = runCatching { configManager.getServiceAgreementInfo() }.getOrElse {
                showPageError("服务协议获取失败")
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
        val p = payload ?: return
        val json = JSONObject().apply {
            put("title", p.title)
            put("content", p.content)
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
}

