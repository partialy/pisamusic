package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.widget.PopupWindow
import androidx.activity.addCallback
import androidx.activity.viewModels
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityPlaylistManagementBinding
import cn.partialy.pm.ui.dialog.PlaylistDeleteConfirmation
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.ui.mine.PlaylistManagementAdapter
import cn.partialy.pm.ui.mine.PlaylistManagementRow
import cn.partialy.pm.ui.mine.PlaylistManagementState
import cn.partialy.pm.ui.mine.PlaylistManagementViewModel
import cn.partialy.pm.ui.mine.PlaylistSourceFilterPopup
import cn.partialy.pm.ui.mine.ThirdPartySourceFilter
import cn.partialy.pm.model.toCanonicalSource
import cn.partialy.pm.ui.mine.managementKey
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class PlaylistManagementActivity : BaseActivity() {
    private val model: PlaylistManagementViewModel by viewModels()
    private lateinit var binding: ActivityPlaylistManagementBinding
    private lateinit var adapter: PlaylistManagementAdapter
    private var sourcePopup: PopupWindow? = null
    private var deleteDialog: android.app.Dialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityPlaylistManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)
        val night = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !night, lightNavigationBarIcons = !night)
        binding.root.applySystemBarsInsets(protectIme = true) { bars ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply { height = bars.top }
            binding.actionSurface.setPadding(0, binding.actionSurface.paddingTop, 0, bars.bottom)
        }
        binding.backButton.setOnClickListener { finishAnimated() }
        onBackPressedDispatcher.addCallback(this) { finishAnimated() }
        binding.searchInput.setText(model.state.value.query)
        binding.searchInput.doAfterTextChanged {
            binding.clearSearchButton.isVisible = !it.isNullOrEmpty()
            model.setQuery(it?.toString().orEmpty())
        }
        binding.clearSearchButton.setOnClickListener { binding.searchInput.text?.clear() }
        adapter = PlaylistManagementAdapter(model::toggle)
        binding.playlistRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.playlistRecyclerView.adapter = adapter
        binding.playlistRecyclerView.itemAnimator = null
        binding.sourceFilterCard.setOnClickListener { showSources() }
        binding.allAction.setOnClickListener { model.selectAll() }
        binding.invertAction.setOnClickListener { model.invert() }
        binding.deleteAction.setOnClickListener {
            if (model.state.value.deleting || deleteDialog?.isShowing == true) return@setOnClickListener
            val generation = cn.partialy.pm.network.auth.AccountSessionStore.libraryGeneration
            val targets = model.selectedPlaylists()
            deleteDialog = PlaylistDeleteConfirmation.showBatch(this, targets) { model.delete(targets, generation) }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) { model.state.collect(::render) }
        }
    }

    private fun render(state: PlaylistManagementState) {
        val rows = state.filtered.map {
            PlaylistManagementRow(it, it.managementKey() in state.selected, !state.deleting && !state.filtering)
        }
        adapter.submitList(rows) {
            state.initialTarget?.let { key ->
                // ListAdapter 的旧提交可能被后续状态取代，只在目标实际出现在当前列表时消费。
                val index = adapter.currentList.indexOfFirst { it.playlist.managementKey() == key }
                if (index >= 0 && model.state.value.initialTarget == key) {
                    (binding.playlistRecyclerView.layoutManager as LinearLayoutManager).scrollToPositionWithOffset(index, 0)
                    model.consumeInitialTarget()
                }
            }
        }
        binding.selectionCounterTextView.text = getString(
            R.string.local_playlist_management_selection_count, state.selected.size, state.playlists.size,
        )
        binding.sourceFilterLabel.setText(PlaylistSourceFilterPopup.labelRes(state.source))
        binding.sourceFilterCard.isEnabled = !state.deleting
        binding.searchInput.isEnabled = !state.deleting
        binding.clearSearchButton.isEnabled = !state.deleting
        binding.clearSearchButton.isVisible = state.query.isNotEmpty()
        binding.emptyContainer.isVisible = state.loaded && rows.isEmpty()
        binding.emptyTextView.setText(if (state.query.isNotBlank() || state.source != ThirdPartySourceFilter.ALL)
            R.string.third_party_import_empty_search else R.string.playlist_management_empty)
        listOf(binding.allAction, binding.invertAction).forEach {
            it.isEnabled = rows.isNotEmpty() && !state.deleting && !state.filtering
            it.alpha = if (it.isEnabled) 1f else 0.45f
        }
        binding.deleteAction.isEnabled = state.selected.isNotEmpty() && !state.deleting
        binding.deleteAction.alpha = if (binding.deleteAction.isEnabled) 1f else 0.45f
        state.deleteResult?.let { (deleted, failed) ->
            model.consumeDeleteResult()
            val message = getString(R.string.playlist_management_delete_result, deleted, failed)
            if (failed > 0) PmMessage.warning(this, message) else PmMessage.success(this, message)
        }
    }

    private fun showSources() {
        val state = model.state.value
        sourcePopup?.dismiss()
        val counts = ThirdPartySourceFilter.values().associateWith { filter ->
            state.playlists.count { filter.sourceKey == null || it.type.toCanonicalSource() == filter.sourceKey }
        }
        sourcePopup = PlaylistSourceFilterPopup.show(binding.sourceFilterCard, state.source, counts, model::setSource)
    }

    private fun finishAnimated() {
        finish()
        AppActivityTransitions.applyBack(this)
    }

    override fun onDestroy() {
        sourcePopup?.dismiss()
        deleteDialog?.dismiss()
        super.onDestroy()
    }

    companion object {
        fun start(context: Context, initialSource: String? = null, initialId: String? = null) {
            context.startActivity(Intent(context, PlaylistManagementActivity::class.java).apply {
                putExtra("initialSource", initialSource)
                putExtra("initialId", initialId)
            })
            AppActivityTransitions.applyForward(context)
        }
    }
}
