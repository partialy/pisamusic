package cn.partialy.pm.activity

import android.app.RecoverableSecurityException
import android.content.IntentSender
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLocalMusicEditBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.local.adapters.LocalMusicEditAdapter
import cn.partialy.pm.utils.LocalMusicMediaStore
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@AndroidEntryPoint
class LocalMusicEditActivity : BaseActivity() {

    private lateinit var binding: ActivityLocalMusicEditBinding
    private val selectedIds = mutableSetOf<Long>()
    private lateinit var adapter: LocalMusicEditAdapter

    private val deleteLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult(),
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            loadRows()
            setResult(RESULT_OK)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLocalMusicEditBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.localMusicEditRoot.applySystemBarsInsets { insets ->
            val lp = binding.localMusicEditStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.localMusicEditStatusBarSpacer.layoutParams = lp
            binding.deleteBarContainer.setPadding(0, 0, 0, insets.bottom)
        }

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.btnDeleteSelected.setOnClickListener {
            if (selectedIds.isNotEmpty()) confirmDelete()
        }

        adapter = LocalMusicEditAdapter(selectedIds) { refreshDeleteButton() }
        binding.recyclerView.layoutManager = LinearLayoutManager(this)
        binding.recyclerView.adapter = adapter

        refreshDeleteButton()
        loadRows()
    }

    private fun refreshDeleteButton() {
        val has = selectedIds.isNotEmpty()
        binding.btnDeleteSelected.isEnabled = has
        binding.btnDeleteSelected.alpha = if (has) 1f else 0.45f
    }

    private fun loadRows() {
        lifecycleScope.launch(Dispatchers.IO) {
            val rows = LocalMusicMediaStore.queryLocalAudioRows(contentResolver)
            withContext(Dispatchers.Main) {
                adapter.submitList(rows)
                val empty = rows.isEmpty()
                binding.emptyView.visibility = if (empty) View.VISIBLE else View.GONE
                binding.recyclerView.visibility = if (empty) View.GONE else View.VISIBLE
                refreshDeleteButton()
            }
        }
    }

    private fun confirmDelete() {
        val n = selectedIds.size
        if (n == 0) return
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.cache_confirm_title)
            .setMessage(getString(R.string.confirm_delete_local, n))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.dialog_ok) { _, _ -> launchDelete(selectedIds.toSet()) }
            .show()
    }

    private fun launchDelete(ids: Set<Long>) {
        if (ids.isEmpty()) return
        val uris = ids.map { LocalMusicMediaStore.contentUri(it) }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val pi = MediaStore.createDeleteRequest(contentResolver, uris)
            deleteLauncher.launch(IntentSenderRequest.Builder(pi.intentSender).build())
            return
        }
        lifecycleScope.launch(Dispatchers.IO) {
            var pendingSender: IntentSender? = null
            for (uri in uris) {
                try {
                    contentResolver.delete(uri, null, null)
                } catch (e: RecoverableSecurityException) {
                    pendingSender = e.userAction.actionIntent.intentSender
                    break
                }
            }
            withContext(Dispatchers.Main) {
                if (pendingSender != null) {
                    deleteLauncher.launch(IntentSenderRequest.Builder(pendingSender).build())
                } else {
                    loadRows()
                    setResult(RESULT_OK)
                }
            }
        }
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(R.anim.slide_to_right_out, R.anim.slide_to_right)
    }
}
