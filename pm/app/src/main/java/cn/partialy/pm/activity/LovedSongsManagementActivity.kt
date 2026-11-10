package cn.partialy.pm.activity

import cn.partialy.pm.ui.message.PmMessage

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.addCallback
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityLocalPlaylistSongManagementBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.mine.LocalPlaylistSongManagementAdapter
import cn.partialy.pm.ui.mine.filterPlaylistSongs
import cn.partialy.pm.ui.mine.invertPlaylistSongs
import cn.partialy.pm.ui.mine.playlistSongKey
import cn.partialy.pm.ui.mine.resolveSelectedPlaylistSongs
import cn.partialy.pm.ui.mine.selectAllPlaylistSongs
import cn.partialy.pm.utils.loveUtil.LoveManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/** 我的收藏歌曲的筛选、批量选择与取消收藏页面；[loveListFlow] 是列表的权威来源。 */
@AndroidEntryPoint
class LovedSongsManagementActivity : BaseDownloadActivity() {

    @Inject lateinit var playlistCollectionManager: cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager

    private lateinit var binding: ActivityLocalPlaylistSongManagementBinding
    private lateinit var adapter: LocalPlaylistSongManagementAdapter
    private val selectedKeys = linkedSetOf<String>()
    private var pendingInitialScrollKey: String? = null
    private var sourceSongs: List<SongInfo> = emptyList()
    private var filteredSongs: List<SongInfo> = emptyList()
    private var renderedCount = PAGE_SIZE
    private var filterJob: Job? = null
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLocalPlaylistSongManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        selectedKeys.addAll(savedInstanceState?.getStringArrayList(SAVED_SELECTION)
            ?: listOfNotNull(intent.getStringExtra(EXTRA_INITIAL_SELECTED)))
        pendingInitialScrollKey = if (savedInstanceState != null) savedInstanceState.getString(SAVED_SCROLL)
            else intent.getStringExtra(EXTRA_INITIAL_SELECTED)
        enableEdgeToEdgeSystemBars()
        applyInsets()
        setupHeader()
        binding.searchInput.setText(savedInstanceState?.getString(SAVED_QUERY).orEmpty())
        setupList()
        setupActions()
        onBackPressedDispatcher.addCallback(this) { finishAnimated() }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                loveManager.loveListFlow.collect { songs ->
                    updateSource(songs)
                }
            }
        }
    }

    private fun setupHeader() {
        binding.titleTextView.setText(R.string.loved_songs_management_title)
        binding.searchInput.setHint(R.string.loved_songs_management_search_hint)
        binding.emptyView.setText(R.string.loved_songs_management_empty)
        binding.backButton.setOnClickListener { finishAnimated() }
        binding.clearSearchButton.setOnClickListener { binding.searchInput.text?.clear() }
        binding.searchInput.doAfterTextChanged { editable ->
            binding.clearSearchButton.isVisible = !editable.isNullOrEmpty()
            scheduleFilter()
        }
    }

    private fun setupList() {
        adapter = LocalPlaylistSongManagementAdapter(::updateSelection)
        binding.songRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@LovedSongsManagementActivity)
            adapter = this@LovedSongsManagementActivity.adapter
            itemAnimator = null
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    if (dy <= 0) return
                    val layoutManager = recyclerView.layoutManager as? LinearLayoutManager ?: return
                    if (layoutManager.findLastVisibleItemPosition() >=
                        this@LovedSongsManagementActivity.adapter.itemCount - LOAD_MORE_THRESHOLD
                    ) {
                        appendNextWindow()
                    }
                }
            })
        }
    }

    private fun setupActions() {
        binding.allAction.setOnClickListener {
            if (busy) return@setOnClickListener
            val allKeys = selectAllPlaylistSongs(filteredSongs, selectedKeys)
            selectedKeys.clear()
            selectedKeys.addAll(allKeys)
            render()
        }
        binding.invertAction.setOnClickListener {
            if (busy) return@setOnClickListener
            val nextSelected = invertPlaylistSongs(filteredSongs, selectedKeys)
            selectedKeys.clear()
            selectedKeys.addAll(nextSelected)
            render()
        }
        binding.operationAction.setOnClickListener { showOperations() }
    }

    private fun showOperations() {
        if (busy) return
        val songs = resolveSelectedPlaylistSongs(sourceSongs, selectedKeys)
        if (songs.isEmpty()) return
        cn.partialy.pm.ui.mine.PlaylistBatchActionCoordinator.show(this, songs, listOf(
            cn.partialy.pm.ui.dialog.ActionMenuItem(
                R.drawable.ic_delete_24, getString(R.string.delete), R.color.pm_dialog_danger,
            ) { confirmDeleteSelected() },
            cn.partialy.pm.ui.dialog.ActionMenuItem(
                R.drawable.ic_download_24, getString(R.string.online_batch_download),
            ) { downloadSelected() },
            cn.partialy.pm.ui.dialog.ActionMenuItem(
                R.drawable.ic_playlist_24, getString(R.string.online_batch_add),
            ) { addSelected() },
        ))
    }

    private fun downloadSelected() {
        if (busy) return
        val songs = resolveSelectedPlaylistSongs(sourceSongs, selectedKeys)
        if (songs.isEmpty()) return
        busy = true
        render()
        startPlaylistBatchDownloadFlow(songs,
            onHandled = { keys ->
                selectedKeys.removeAll(keys)
                if (!isDestroyed) render()
            },
            onFinished = {
                busy = false
                if (!isDestroyed) render()
            })
    }

    private fun addSelected() {
        if (busy) return
        val songs = resolveSelectedPlaylistSongs(sourceSongs, selectedKeys)
        if (songs.isEmpty()) return
        busy = true
        render()
        cn.partialy.pm.ui.mine.PlaylistBatchActionCoordinator.addSelected(
            this, songs, musicController, playlistCollectionManager,
            onHandled = { keys ->
                selectedKeys.removeAll(keys)
                if (!isDestroyed) render()
            },
            onFinished = {
                busy = false
                if (!isDestroyed) render()
            },
        )
    }

    private fun confirmDeleteSelected() {
        if (busy) return
        val songs = resolveSelectedPlaylistSongs(sourceSongs, selectedKeys)
        if (songs.isEmpty()) return
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.loved_songs_management_unlove_confirm_title),
            message = getString(R.string.loved_songs_management_unlove_confirm_message, songs.size),
            cancelText = getString(R.string.cancel),
            confirmText = getString(R.string.dialog_ok),
            confirmColor = ContextCompat.getColor(this, R.color.pm_dialog_danger),
            onConfirm = {
                if (!busy) {
                    busy = true
                    render()
                    val keys = selectedKeys.toSet()
                    lifecycleScope.launch {
                        try {
                            val removedKeys = withContext(Dispatchers.IO) {
                                val targets = resolveSelectedPlaylistSongs(loveManager.loveListFlow.value, keys)
                                loveManager.removeSongsFromLoveList(targets)
                                val remaining = loveManager.loveListFlow.value.mapTo(hashSetOf(), ::playlistSongKey)
                                targets.mapTo(linkedSetOf(), ::playlistSongKey) - remaining
                            }
                            selectedKeys.removeAll(removedKeys)
                            if (removedKeys.isNotEmpty()) {
                                PmMessage.success(this@LovedSongsManagementActivity,
                                    getString(R.string.loved_songs_management_unlove_success, removedKeys.size))
                            } else {
                                PmMessage.warning(this@LovedSongsManagementActivity, R.string.playlist_batch_remove_failed)
                            }
                        } catch (cancel: kotlinx.coroutines.CancellationException) {
                            throw cancel
                        } catch (_: Exception) {
                            PmMessage.error(this@LovedSongsManagementActivity, R.string.playlist_batch_remove_failed)
                        } finally {
                            busy = false
                            if (!isDestroyed) render()
                        }
                    }
                }
            },
        )
    }

    private fun updateSource(songs: List<SongInfo>) {
        sourceSongs = songs
        selectedKeys.retainAll(sourceSongs.mapTo(mutableSetOf(), ::playlistSongKey))
        scheduleFilter()
    }

    private fun scheduleFilter() {
        filterJob?.cancel()
        val query = binding.searchInput.text?.toString().orEmpty().trim()
        val sourceSnapshot = sourceSongs
        filterJob = lifecycleScope.launch {
            delay(FILTER_DEBOUNCE_MS)
            val filtered = withContext(Dispatchers.Default) {
                filterPlaylistSongs(sourceSnapshot, query)
            }
            filteredSongs = filtered
            renderedCount = PAGE_SIZE
            render()
        }
    }

    private fun appendNextWindow() {
        if (renderedCount >= filteredSongs.size) return
        renderedCount = (renderedCount + PAGE_SIZE).coerceAtMost(filteredSongs.size)
        render()
    }

    private fun updateSelection(song: SongInfo, selected: Boolean) {
        val key = playlistSongKey(song)
        if (selected) selectedKeys.add(key) else selectedKeys.remove(key)
        render()
    }

    private fun render() {
        val rendered = filteredSongs.take(renderedCount)
        val initialIndex = pendingInitialScrollKey?.let { key ->
            filteredSongs.indexOfFirst { playlistSongKey(it) == key }.takeIf { it >= 0 }
        }
        if (initialIndex != null) {
            renderedCount = maxOf(renderedCount, initialIndex + 1)
            pendingInitialScrollKey = null
        }
        adapter.submit(filteredSongs.take(renderedCount), selectedKeys)
        if (initialIndex != null) {
            binding.songRecyclerView.post {
                (binding.songRecyclerView.layoutManager as? LinearLayoutManager)
                    ?.scrollToPositionWithOffset(initialIndex, 0)
            }
        }
        binding.selectionCounterTextView.text = getString(
            R.string.local_playlist_song_management_selection_count,
            selectedKeys.size,
            sourceSongs.size,
        )
        binding.songRecyclerView.isVisible = rendered.isNotEmpty()
        binding.emptyView.isVisible = filteredSongs.isEmpty()
        binding.operationAction.isEnabled = selectedKeys.isNotEmpty() && !busy
        binding.operationAction.alpha = if (binding.operationAction.isEnabled) 1f else DISABLED_ACTION_ALPHA
        listOf(binding.allAction, binding.invertAction).forEach {
            it.isEnabled = !busy && filteredSongs.isNotEmpty()
            it.alpha = if (it.isEnabled) 1f else DISABLED_ACTION_ALPHA
        }
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

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putStringArrayList(SAVED_SELECTION, ArrayList(selectedKeys))
        outState.putString(SAVED_SCROLL, pendingInitialScrollKey)
        outState.putString(SAVED_QUERY, binding.searchInput.text?.toString().orEmpty())
        super.onSaveInstanceState(outState)
    }

    companion object {
        private const val EXTRA_INITIAL_SELECTED = "initial_selected_song_key"
        private const val SAVED_SELECTION = "selectedKeys"
        private const val SAVED_SCROLL = "pendingScroll"
        private const val SAVED_QUERY = "query"
        private const val PAGE_SIZE = 40
        private const val LOAD_MORE_THRESHOLD = 8
        private const val FILTER_DEBOUNCE_MS = 150L
        private const val DISABLED_ACTION_ALPHA = 0.45f

        fun start(context: Context, initialSelectedKey: String? = null) {
            val intent = Intent(context, LovedSongsManagementActivity::class.java).apply {
                putExtra(EXTRA_INITIAL_SELECTED, initialSelectedKey)
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
