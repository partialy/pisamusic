package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.addCallback
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLocalPlaylistManagementBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.ui.dialog.PlaylistDeleteConfirmation
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.mine.LocalPlaylistManagementAdapter
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/** 本地歌单的筛选、批量选择与删除页面；[playlistsFlow] 是列表的唯一权威来源。 */
@AndroidEntryPoint
class LocalPlaylistManagementActivity : BaseActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityLocalPlaylistManagementBinding
    private lateinit var adapter: LocalPlaylistManagementAdapter
    private val selectedIds = linkedSetOf<String>()
    private var sourcePlaylists: List<CollectedPlaylist> = emptyList()
    private var filteredPlaylists: List<CollectedPlaylist> = emptyList()
    private var renderedCount = PAGE_SIZE
    private var filterJob: Job? = null
    private var hasFlowSnapshot = false

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLocalPlaylistManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars()
        applyInsets()
        setupHeader()
        setupList()
        setupActions()
        onBackPressedDispatcher.addCallback(this) { finishAnimated() }

        lifecycleScope.launch {
            val initial = withContext(Dispatchers.IO) {
                playlistCollectionManager.getAllPlaylists()
                    .filter { it.type == CollectedPlaylistType.LOCAL }
            }
            if (!hasFlowSnapshot) updateSource(initial)
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                playlistCollectionManager.playlistsFlow.collect { playlists ->
                    hasFlowSnapshot = true
                    updateSource(playlists.filter { it.type == CollectedPlaylistType.LOCAL })
                }
            }
        }
    }

    private fun setupHeader() {
        binding.backButton.setOnClickListener { finishAnimated() }
        binding.clearSearchButton.setOnClickListener { binding.searchInput.text?.clear() }
        binding.searchInput.doAfterTextChanged { editable ->
            binding.clearSearchButton.isVisible = !editable.isNullOrEmpty()
            scheduleFilter()
        }
    }

    private fun setupList() {
        adapter = LocalPlaylistManagementAdapter(::updateSelection)
        binding.playlistRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@LocalPlaylistManagementActivity)
            adapter = this@LocalPlaylistManagementActivity.adapter
            itemAnimator = null
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    if (dy <= 0) return
                    val layoutManager = recyclerView.layoutManager as? LinearLayoutManager ?: return
                    if (layoutManager.findLastVisibleItemPosition() >=
                        this@LocalPlaylistManagementActivity.adapter.itemCount - LOAD_MORE_THRESHOLD
                    ) {
                        appendNextWindow()
                    }
                }
            })
        }
    }

    private fun setupActions() {
        binding.allAction.setOnClickListener {
            selectedIds.addAll(filteredPlaylists.map(CollectedPlaylist::id))
            render()
        }
        binding.invertAction.setOnClickListener {
            filteredPlaylists.forEach { playlist ->
                if (!selectedIds.add(playlist.id)) selectedIds.remove(playlist.id)
            }
            render()
        }
        binding.deleteAction.setOnClickListener {
            PlaylistDeleteConfirmation.showLocalBatch(
                this,
                selectedPlaylists(),
                playlistCollectionManager,
            ) { _, _ ->
                // 不乐观移除行；等待 playlistsFlow 的权威快照更新。
            }
        }
    }

    private fun updateSource(playlists: List<CollectedPlaylist>) {
        sourcePlaylists = playlists
        selectedIds.retainAll(sourcePlaylists.mapTo(mutableSetOf(), CollectedPlaylist::id))
        scheduleFilter()
    }

    /** 在 Default 线程防抖并取消上一次未完成的查询。 */
    private fun scheduleFilter() {
        filterJob?.cancel()
        val query = binding.searchInput.text?.toString().orEmpty().trim()
        val sourceSnapshot = sourcePlaylists
        filterJob = lifecycleScope.launch {
            delay(FILTER_DEBOUNCE_MS)
            val filtered = withContext(Dispatchers.Default) {
                if (query.isBlank()) sourceSnapshot else sourceSnapshot.filter { playlist ->
                    playlist.name.contains(query, ignoreCase = true)
                }
            }
            filteredPlaylists = filtered
            renderedCount = PAGE_SIZE
            render()
        }
    }

    private fun appendNextWindow() {
        if (renderedCount >= filteredPlaylists.size) return
        renderedCount = (renderedCount + PAGE_SIZE).coerceAtMost(filteredPlaylists.size)
        render()
    }

    private fun updateSelection(playlist: CollectedPlaylist, selected: Boolean) {
        if (selected) selectedIds.add(playlist.id) else selectedIds.remove(playlist.id)
        render()
    }

    /** 删除始终从完整来源快照解析，不能只取当前渲染的 40 条。 */
    private fun selectedPlaylists(): List<CollectedPlaylist> =
        sourcePlaylists.filter { it.id in selectedIds }

    private fun render() {
        val rendered = filteredPlaylists.take(renderedCount)
        adapter.submit(rendered, selectedIds)
        binding.selectionCounterTextView.text = getString(
            R.string.local_playlist_management_selection_count,
            selectedIds.size,
            sourcePlaylists.size,
        )
        binding.playlistRecyclerView.isVisible = rendered.isNotEmpty()
        binding.emptyView.isVisible = filteredPlaylists.isEmpty()
        binding.deleteAction.isEnabled = selectedIds.isNotEmpty()
        binding.deleteAction.alpha = if (selectedIds.isEmpty()) DISABLED_ACTION_ALPHA else 1f
    }

    private fun applyInsets() {
        binding.root.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.actionSurface.setPadding(0, 0, 0, insets.bottom)
        }
    }

    private fun finishAnimated() {
        finish()
        AppActivityTransitions.applyBack(this)
    }

    override fun onDestroy() {
        filterJob?.cancel()
        super.onDestroy()
    }

    companion object {
        private const val PAGE_SIZE = 40
        private const val LOAD_MORE_THRESHOLD = 8
        private const val FILTER_DEBOUNCE_MS = 150L
        private const val DISABLED_ACTION_ALPHA = 0.45f

        fun start(context: Context) {
            context.startActivity(Intent(context, LocalPlaylistManagementActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
