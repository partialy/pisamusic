package cn.partialy.pm.activity

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
    @Inject lateinit var trackLoader: OnlinePlaylistBatchTrackLoader
    private lateinit var binding: ActivityOnlinePlaylistBatchBinding
    private lateinit var adapter: LocalPlaylistSongManagementAdapter
    private lateinit var source: SongType
    private var playlistId = ""
    private var sourceSongs: List<SongInfo> = emptyList()
    private var filteredSongs: List<SongInfo> = emptyList()
    private val selectedKeys = linkedSetOf<String>()
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
        selectedKeys.addAll(savedInstanceState?.getStringArrayList(SELECTED).orEmpty())
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
        binding.downloadAction.setOnClickListener { downloadSelected() }
        binding.favoriteAction.setOnClickListener { favoriteSelected() }
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

    private fun downloadSelected() {
        val songs = resolveSelectedPlaylistSongs(sourceSongs, selectedKeys)
        if (songs.isEmpty() || busy) return
        busy = true
        render()
        val finishFlow = { busy = false; render() }
        var downloadHandedOff = false
        val enqueue = {
            downloadHandedOff = true
            startSongsDownloadFlow(songs, onResult = { result ->
                val handled = result.enqueuedKeys + result.skippedKeys
                songs.filter { "${it.type}:${it.id}" in handled }.forEach { selectedKeys.remove(playlistSongKey(it)) }
                render()
            }, onFinished = finishFlow)
        }
        if (songs.size > 100) {
            PmMinimalDialog.show(this,
                message = getString(R.string.online_batch_large_download, songs.size),
                cancelText = getString(R.string.cancel), confirmText = getString(R.string.dialog_ok),
                onCancel = finishFlow, onConfirm = { enqueue() }).setOnDismissListener {
                    // 确认回调同步打开音质选择器；取消/手势关闭只释放尚未转交的流程。
                    if (!downloadHandedOff) finishFlow()
                }
        } else enqueue()
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
                showMessage(getString(R.string.online_batch_favorite_result, result.added.size, result.existing.size, result.failed.size))
            } finally {
                busy = false
                render()
            }
        }
    }

    private fun render() {
        adapter.submit(filteredSongs.take(renderedCount), selectedKeys)
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
        setActionEnabled(binding.downloadAction, hasSelection && !busy)
        setActionEnabled(binding.favoriteAction, hasSelection && !busy)
    }

    private fun setActionEnabled(view: View, enabled: Boolean) {
        view.isEnabled = enabled
        view.alpha = if (enabled) 1f else 0.45f
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString(QUERY, binding.searchInput.text.toString())
        outState.putStringArrayList(SELECTED, ArrayList(selectedKeys))
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

        fun start(context: Context, source: SongType, playlistId: String, title: String, songs: List<SongInfo>, total: Int) {
            context.startActivity(Intent(context, OnlinePlaylistBatchActivity::class.java).apply {
                putExtra(SOURCE, source.name); putExtra(ID, playlistId); putExtra(TITLE, title)
                putExtra(TOTAL, total); putExtra(TOKEN, OnlinePlaylistBatchSessionStore.put(songs))
            })
            AppActivityTransitions.applyForward(context)
        }
    }
}
