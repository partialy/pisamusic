package cn.partialy.pm.activity.setting

import android.os.Bundle
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.network.config.ConfigManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SettingServiceAgreementActivity : BaseSettingPlainTextActivity() {

    @Inject
    lateinit var configManager: ConfigManager

    override fun headerTitle(): String = getString(R.string.page_service_agreement_title)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            runCatching { configManager.getServiceAgreementInfo() }.onSuccess {
                setPlainText(it.title, it.content)
            }.onFailure {
                showPageError(getString(R.string.page_service_agreement_load_failed))
            }
        }
    }

    private fun showPageError(message: String) {
        showPlainTextError(message)
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
}

