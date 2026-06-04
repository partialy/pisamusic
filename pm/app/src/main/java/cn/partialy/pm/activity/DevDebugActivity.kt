package cn.partialy.pm.activity

import android.os.Bundle
import androidx.annotation.StringRes
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityDevDebugBinding
import cn.partialy.pm.network.CookieHttpResult
import cn.partialy.pm.network.cookie.KugouCookieRepository
import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.cookie.WyCookieRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * 设置页底部的开发专用入口：查看 SQLite Cookie、带 Cookie 仓库的接口调试。
 */
@AndroidEntryPoint
class DevDebugActivity : BaseActivity() {

    @Inject
    lateinit var kugouCookieRepository: KugouCookieRepository

    @Inject
    lateinit var wyCookieRepository: WyCookieRepository

    @Inject
    lateinit var musicCookieManager: MusicCookieManager

    private lateinit var binding: ActivityDevDebugBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityDevDebugBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.btnShowKgStoreCookie.setOnClickListener {
            showCookieState(
                titleRes = R.string.dev_debug_show_kg_store_cookie,
                source = MusicCookieManager.SOURCE_KG,
            )
        }
        binding.btnShowWyStoreCookie.setOnClickListener {
            showCookieState(
                titleRes = R.string.dev_debug_show_wy_store_cookie,
                source = MusicCookieManager.SOURCE_WY,
            )
        }

        binding.btnTestKgUserDetail.setOnClickListener {
            runCookieApiTest { kugouCookieRepository.getUserDetailRaw() }
        }
        binding.btnTestWyAccount.setOnClickListener {
            runCookieApiTest { wyCookieRepository.getAccountRaw() }
        }
    }

    private fun showCookieState(@StringRes titleRes: Int, source: String) {
        val title = getString(titleRes)
        val state = musicCookieManager.getCookie(source)
        val profile = musicCookieManager.getProfile(source)
        val body = buildString {
            appendLine(title)
            appendLine()
            appendLine("exist=${state.exist}")
            appendLine("userId=${profile?.userId.orEmpty()}")
            appendLine("username=${profile?.username.orEmpty()}")
            appendLine("nickname=${profile?.nickname.orEmpty()}")
            appendLine("isVip=${profile?.isVip ?: false}")
            appendLine("avatarUrl=${profile?.avatarUrl.orEmpty()}")
            appendLine()
            appendLine("--- cookie ---")
            append(state.cookie.trim().ifEmpty { getString(R.string.dev_debug_cookie_empty) })
        }
        binding.apiResultOutput.setText(body)
    }

    private fun runCookieApiTest(block: suspend () -> CookieHttpResult) {
        binding.apiResultOutput.setText(getString(R.string.dev_debug_api_requesting))
        lifecycleScope.launch {
            val text = withContext(Dispatchers.IO) {
                runCatching { block() }
                    .fold(
                        onSuccess = { formatHttpResult(it) },
                        onFailure = { e -> "错误: ${e.message}\n${e.stackTraceToString()}" },
                    )
            }
            binding.apiResultOutput.setText(text)
        }
    }

    private fun formatHttpResult(r: CookieHttpResult): String = buildString {
        appendLine("HTTP ${r.code}  isSuccessful=${r.isSuccessful}")
        appendLine("--- body ---")
        append(r.body)
        if (r.cookieHeaderForNextRequest.isNotBlank()) {
            appendLine()
            appendLine("--- cookieHeaderForNextRequest ---")
            append(r.cookieHeaderForNextRequest)
        }
    }

}
