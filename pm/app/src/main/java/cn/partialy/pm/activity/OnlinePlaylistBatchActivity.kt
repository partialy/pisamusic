package cn.partialy.pm.activity

import cn.partialy.pm.ui.message.PmMessage

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import androidx.activity.addCallback
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityOnlinePlaylistBatchBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.mine.LocalPlaylistSongManagementAdapter
import cn.partialy.pm.ui.mine.filterPlaylistSongs
import cn.partialy.pm.ui.mine.invertPlaylistSongs
import cn.partialy.pm.ui.mine.playlistSongKey
import cn.partialy.pm.ui.mine.resolveSelectedPlaylistSongs
import cn.partialy.pm.ui.mine.selectAllPlaylistSongs
import cn.partialy.pm.ui.playlistdetail.OnlinePlaylistBatchSessionStore
import cn.partialy.pm.ui.playlistdetail.OnlinePlaylistBatchTrackLoader
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/** 在线歌单的批量操作只作用于歌曲，绝不改动源歌单。 */
@AndroidEntryPoint
class OnlinePlaylistBatchActivity : BaseDownloadActivity() {
    @Inject lateinit var playlistCollectionManager: cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
    @Inject lateinit var trackLoader: OnlinePlaylistBatchTrackLoader
    private lateinit var binding: ActivityOnlinePlaylistBatchBinding
    private lateinit var adapter: LocalPlaylistSongManagementAdapter
    private lateinit var source: SongType
    private var playlistId = ""
    private var sourceSongs: List<SongInfo> = emptyList()
    private var filteredSongs: List<SongInfo> = emptyList()
    private val selectedKeys = linkedSetOf<String>()
    private var pendingInitialScrollKey: String? = null
    private var complete = false
    private var loadFailed = false
    private var busy = false
    private var renderedCount = PAGE_SIZE
    private var filterJob: Job? = null
    private var loadJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityOnlinePlaylistBatchBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)
        source = runCatching { SongType.valueOf(intent.getStringExtra(SOURCE).orEmpty()) }.getOrNull()
            ?.takeIf { it == SongType.KG || it == SongType.WY } ?: run { finish(); return }
        playlistId = intent.getStringExtra(ID).orEmpty()
        if (playlistId.isBlank()) { finish(); return }
        selectedKeys.addAll(savedInstanceState?.getStringArrayList(SELECTED)
            ?: listOfNotNull(intent.getStringExtra(INITIAL_SELECTED)))
        pendingInitialScrollKey = if (savedInstanceState != null) savedInstanceState.getString(PENDING_SCROLL)
            else intent.getStringExtra(INITIAL_SELECTED)
        sourceSongs = OnlinePlaylistBatchSessionStore.get(savedInstanceState?.getString(TOKEN) ?: intent.getStringExtra(TOKEN))
        val isNight = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !isNight, lightNavigationBarIcons = !isNight)
        binding.root.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply { height = insets.top }
            binding.actionSurface.setPadding(0, 0, 0, insets.bottom)
        }
        binding.titleTextView.text = intent.getStringExtra(TITLE).orEmpty().ifBlank { getString(R.string.online_batch_title) }
        binding.backButton.setOnClickListener { finishAnimated() }
        onBackPressedDispatcher.addCallback(this) { finishAnimated() }
        adapter = LocalPlaylistSongManagementAdapter { song, selected ->
            if (selected) selectedKeys.add(playlistSongKey(song)) else selectedKeys.remove(playlistSongKey(song))
            render()
        }
        binding.songRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@OnlinePlaylistBatchActivity)
            adapter = this@OnlinePlaylistBatchActivity.adapter
            itemAnimator = null
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    if (dy > 0 && (layoutManager as LinearLayoutManager).findLastVisibleItemPosition() >=
                        this@OnlinePlaylistBatchActivity.adapter.itemCount - 8 && renderedCount < filteredSongs.size) {
                        renderedCount += PAGE_SIZE
                        render()
                    }
                }
            })
        }
        binding.searchInput.setText(savedInstanceState?.getString(QUERY).orEmpty())
        binding.clearSearchButton.isVisible = !binding.searchInput.text.isNullOrEmpty()
        binding.searchInput.doAfterTextChanged {
            binding.clearSearchButton.isVisible = !it.isNullOrEmpty()
            scheduleFilter(resetWindow = true)
        }
        binding.clearSearchButton.setOnClickListener { binding.searchInput.text?.clear() }
        binding.loadStatus.setOnClickListener { if (loadFailed) loadTracks() }
        binding.allAction.setOnClickListener {
            selectedKeys.addAll(selectAllPlaylistSongs(filteredSongs, selectedKeys))
            render()
        }
        binding.invertAction.setOnClickListener {
            val next = invertPlaylistSongs(filteredSongs, selectedKeys)
            selectedKeys.clear(); selectedKeys.addAll(next)
            render()
        }
        binding.operationAction.setOnClickListener { showOperations() }
        scheduleFilter()
        loadTracks()
    }

    private fun loadTracks() {
        loadJob?.cancel()
        complete = false
        loadFailed = false
        render()
        loadJob = lifecycleScope.launch {
            trackLoader.load(source, playlistId, intent.getIntExtra(TOTAL, 0), sourceSongs) { state ->
                withContext(Dispatchers.Main) {
                    sourceSongs = state.songs
                    complete = state.complete
                    loadFailed = state.failed
                    if (complete) selectedKeys.retainAll(sourceSongs.mapTo(mutableSetOf(), ::playlistSongKey))
                    scheduleFilter(resetWindow = false)
                    render()
                }
            }
        }
    }

    private fun scheduleFilter(resetWindow: Boolean = true) {
        filterJob?.cancel()
        val snapshot = sourceSongs
        val query = binding.searchInput.text.toString()
        filterJob = lifecycleScope.launch {
            delay(150)
            filteredSongs = withContext(Dispatchers.Default) { filterPlaylistSongs(snapshot, query) }
            if (resetWindow) renderedCount = PAGE_SIZE
            render()
        }
    }

    private fun showOperations() {
        if (busy) return
        val songs = resolveSelectedPlaylistSongs(sourceSongs, selectedKeys)
        if (songs.isEmpty()) return
        cn.partialy.pm.ui.mine.PlaylistBatchActionCoordinator.show(this, songs, listOf(
            cn.partialy.pm.ui.dialog.ActionMenuItem(
                R.drawable.ic_download_24, getString(R.string.online_batch_download),
            ) { downloadSelected() },
            cn.partialy.pm.ui.dialog.ActionMenuItem(
                R.drawable.ic_love_24, getString(R.string.online_batch_favorite),
            ) { favoriteSelected() },
            cn.partialy.pm.ui.dialog.ActionMenuItem(
                R.drawable.ic_playlist_24, getString(R.string.online_batch_add),
            ) { addSelected() },
        ))
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
            },
        )
    }

    private fun favoriteSelected() {
        val songs = resolveSelectedPlaylistSongs(sourceSongs, selectedKeys)
        if (songs.isEmpty() || busy) return
        busy = true
        render()
        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { loveManager.addSongsToLoveList(songs) }
                (result.added + result.existing).forEach { selectedKeys.remove(playlistSongKey(it)) }
                PmMessage.show(this@OnlinePlaylistBatchActivity, if (result.failed.isNotEmpty()) cn.partialy.pm.ui.message.MessageType.WARNING else cn.partialy.pm.ui.message.MessageType.SUCCESS, getString(R.string.online_batch_favorite_result, result.added.size, result.existing.size, result.failed.size), 2000L, null)
            } finally {
                busy = false
                render()
            }
        }
    }

    private fun render() {
        val initialIndex = pendingInitialScrollKey?.let { key ->
            filteredSongs.indexOfFirst { playlistSongKey(it) == key }.takeIf { it >= 0 }
        }
        if (initialIndex != null) {
            renderedCount = maxOf(renderedCount, initialIndex + 1)
            pendingInitialScrollKey = null
        } else if (complete) {
            pendingInitialScrollKey = null
        }
        adapter.submit(filteredSongs.take(renderedCount), selectedKeys)
        if (initialIndex != null) {
            binding.songRecyclerView.post {
                (binding.songRecyclerView.layoutManager as? LinearLayoutManager)
                    ?.scrollToPositionWithOffset(initialIndex, 0)
            }
        }
        binding.selectionCounterTextView.text = getString(R.string.local_playlist_song_management_selection_count, selectedKeys.size, sourceSongs.size)
        binding.emptyView.isVisible = filteredSongs.isEmpty()
        binding.songRecyclerView.isVisible = filteredSongs.isNotEmpty()
        binding.loadStatus.text = when {
            loadFailed -> getString(R.string.online_batch_failed, sourceSongs.size)
            complete -> getString(R.string.online_batch_complete, sourceSongs.size)
            else -> getString(R.string.online_batch_loading, sourceSongs.size)
        }
        setActionEnabled(binding.allAction, complete && filteredSongs.isNotEmpty() && !busy)
        setActionEnabled(binding.invertAction, complete && filteredSongs.isNotEmpty() && !busy)
        val hasSelection = sourceSongs.any { playlistSongKey(it) in selectedKeys }
        setActionEnabled(binding.operationAction, hasSelection && !busy)
    }

    private fun setActionEnabled(view: View, enabled: Boolean) {
        view.isEnabled = enabled
        view.alpha = if (enabled) 1f else 0.45f
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString(QUERY, binding.searchInput.text.toString())
        outState.putStringArrayList(SELECTED, ArrayList(selectedKeys))
        outState.putString(PENDING_SCROLL, pendingInitialScrollKey)
        outState.putString(TOKEN, OnlinePlaylistBatchSessionStore.put(sourceSongs))
        super.onSaveInstanceState(outState)
    }

    private fun finishAnimated() { finish(); AppActivityTransitions.applyBack(this) }

    companion object {
        private const val PAGE_SIZE = 40
        private const val SOURCE = "source"
        private const val ID = "playlistId"
        private const val TITLE = "title"
        private const val TOTAL = "total"
        private const val TOKEN = "sessionToken"
        private const val QUERY = "query"
        private const val SELECTED = "selectedKeys"
        private const val INITIAL_SELECTED = "initial_selected_song_key"
        private const val PENDING_SCROLL = "pendingScroll"

        fun start(context: Context, source: SongType, playlistId: String, title: String, songs: List<SongInfo>, total: Int, initialSelectedKey: String? = null) {
            context.startActivity(Intent(context, OnlinePlaylistBatchActivity::class.java).apply {
                putExtra(SOURCE, source.name); putExtra(ID, playlistId); putExtra(TITLE, title)
                putExtra(TOTAL, total); putExtra(TOKEN, OnlinePlaylistBatchSessionStore.put(songs))
                putExtra(INITIAL_SELECTED, initialSelectedKey)
            })
            AppActivityTransitions.applyForward(context)
        }
    }
}
