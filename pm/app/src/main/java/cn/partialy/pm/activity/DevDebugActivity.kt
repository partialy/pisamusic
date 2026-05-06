package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.documentfile.provider.DocumentFile
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityDevDebugBinding
import cn.partialy.pm.network.CookieHttpResult
import cn.partialy.pm.network.cookie.CookiePersistenceFileNames
import cn.partialy.pm.network.cookie.KugouCookieRepository
import cn.partialy.pm.network.cookie.WyCookieRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import android.widget.Toast
import androidx.annotation.StringRes
import java.io.File
import java.io.FileInputStream
import javax.inject.Inject

/**
 * 设置页底部的开发专用入口：导出 Cookie、带 Cookie 仓库的接口调试。
 */
@AndroidEntryPoint
class DevDebugActivity : BaseActivity() {

    @Inject
    lateinit var kugouCookieRepository: KugouCookieRepository

    @Inject
    lateinit var wyCookieRepository: WyCookieRepository

    private lateinit var binding: ActivityDevDebugBinding

    private val pickExportDirLauncher = registerForActivityResult(
        object : ActivityResultContracts.OpenDocumentTree() {
            override fun createIntent(context: Context, input: Uri?): Intent =
                super.createIntent(context, input).apply {
                    addFlags(
                        Intent.FLAG_GRANT_READ_URI_PERMISSION or
                            Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
                    )
                }
        },
    ) { treeUri ->
        if (treeUri == null) return@registerForActivityResult
        lifecycleScope.launch {
            val message = withContext(Dispatchers.IO) {
                runCatching {
                    contentResolver.takePersistableUriPermission(
                        treeUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
                    )
                }
                exportCookieJsonFiles(treeUri)
            }
            Toast.makeText(
                this@DevDebugActivity,
                message,
                Toast.LENGTH_LONG,
            ).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityDevDebugBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.btnExportCookies.setOnClickListener {
            pickExportDirLauncher.launch(null)
        }

        binding.btnShowKgStoreCookie.setOnClickListener {
            lifecycleScope.launch {
                withContext(Dispatchers.IO) {
                    kugouCookieRepository.reloadPersistedCookieFromDisk()
                }
                showMemoryCookieHeader(
                    titleRes = R.string.dev_debug_show_kg_store_cookie,
                    cookie = kugouCookieRepository.getCookie(),
                )
            }
        }
        binding.btnShowWyStoreCookie.setOnClickListener {
            lifecycleScope.launch {
                withContext(Dispatchers.IO) {
                    wyCookieRepository.reloadPersistedCookieFromDisk()
                }
                showMemoryCookieHeader(
                    titleRes = R.string.dev_debug_show_wy_store_cookie,
                    cookie = wyCookieRepository.getCookie(),
                )
            }
        }

        binding.btnTestKgUserDetail.setOnClickListener {
            runCookieApiTest { kugouCookieRepository.getUserDetailRaw() }
        }
        binding.btnTestWyAccount.setOnClickListener {
            runCookieApiTest { wyCookieRepository.getAccountRaw() }
        }
    }

    private fun showMemoryCookieHeader(@StringRes titleRes: Int, cookie: String) {
        val title = getString(titleRes)
        val body = cookie.trim().ifEmpty { getString(R.string.dev_debug_cookie_empty) }
        binding.apiResultOutput.setText("$title\n\n$body")
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
            appendLine("--- cookieHeaderForNextRequest (合并后) ---")
            append(r.cookieHeaderForNextRequest)
        }
    }

    /**
     * 将 [filesDir] 下 [CookiePersistenceFileNames] 对应文件复制到 SAF 目录树。
     * @return 用于 Toast 的说明文案
     */
    private fun exportCookieJsonFiles(treeUri: Uri): String {
        val tree = DocumentFile.fromTreeUri(this, treeUri)
            ?: return getString(R.string.dev_debug_export_invalid_tree)
        var exported = 0
        var missing = 0
        for (name in CookiePersistenceFileNames.ALL) {
            val src = File(filesDir, name)
            if (!src.exists() || src.length() == 0L) {
                missing++
                continue
            }
            tree.findFile(name)?.delete()
            val doc = tree.createFile("application/json", name) ?: continue
            contentResolver.openOutputStream(doc.uri)?.use { out ->
                FileInputStream(src).use { it.copyTo(out) }
                exported++
            } ?: continue
        }
        return when {
            exported == 0 -> getString(R.string.dev_debug_export_none)
            else -> getString(R.string.dev_debug_export_done, exported, missing)
        }
    }
}
