package cn.partialy.pm.activity.setting

import android.content.res.Configuration
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.announcement.AnnouncementDetailBottomSheet
import cn.partialy.pm.model.AnnouncementItem
import cn.partialy.pm.network.repository.SystemRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import javax.inject.Inject

@AndroidEntryPoint
class SettingAnnouncementsActivity : BaseSettingWebActivity() {

    @Inject
    lateinit var systemRepository: SystemRepository

    private var pageReady = false
    private var announcements: List<AnnouncementItem> = emptyList()

    override fun headerTitle(): String = getString(R.string.settings_announcements)

    override fun initialUrl(): String {
        val isDark =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        return "file:///android_asset/setting/announcements.html?theme=${if (isDark) "dark" else "light"}"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding.webContentWebView.addJavascriptInterface(AnnouncementsBridge(), "AndroidAnnouncementHost")
        lifecycleScope.launch {
            val response = systemRepository.getAnnouncements().getOrElse {
                showPageError(getString(R.string.page_announcement_load_failed))
                return@launch
            }
            if (!response.success || response.code != 0) {
                showPageError(response.msg.ifBlank { getString(R.string.page_announcement_load_failed) })
                return@launch
            }
            announcements = response.data
            renderPageState()
        }
    }

    override fun onWebViewPageFinished(url: String?) {
        pageReady = true
        renderPageState()
    }

    private fun renderPageState() {
        if (!pageReady) return
        val payload = JSONArray().apply {
            announcements.forEach { item ->
                put(
                    JSONObject().apply {
                        put("id", item.id)
                        put("content", cn.partialy.pm.announcement.announcementPreview(item.content))
                        put("time", item.time)
                        put("publisher", item.publisher)
                        put("confirmText", item.confirmText)
                        put("showGotoButton", item.showGotoButton)
                        put("gotoUrl", item.gotoUrl.orEmpty())
                    },
                )
            }
        }
        binding.webContentWebView.evaluateJavascript(
            "window.PM_ANNOUNCEMENTS && window.PM_ANNOUNCEMENTS.render($payload);",
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
            "window.PM_ANNOUNCEMENTS && window.PM_ANNOUNCEMENTS.setError($msg);",
            null,
        )
    }

    private inner class AnnouncementsBridge {
        @JavascriptInterface
        fun openAnnouncement(id: String?) {
            val item = announcements.firstOrNull { it.id == id?.trim() } ?: return
            runOnUiThread {
                AnnouncementDetailBottomSheet.show(
                    activity = this@SettingAnnouncementsActivity,
                    item = item,
                    onConfirmed = {
                        lifecycleScope.launch(Dispatchers.IO) {
                            systemRepository.markAnnouncementRead(item.id)
                        }
                    },
                )
            }
        }

    }
}
