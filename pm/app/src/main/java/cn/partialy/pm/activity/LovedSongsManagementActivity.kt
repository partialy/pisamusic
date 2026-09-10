package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
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
import cn.partialy.pm.activity.base.BaseActivity
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
class LovedSongsManagementActivity : BaseActivity() {

    private lateinit var binding: ActivityLocalPlaylistSongManagementBinding
    private lateinit var adapter: LocalPlaylistSongManagementAdapter
    private val selectedKeys = linkedSetOf<String>()
    private var sourceSongs: List<SongInfo> = emptyList()
    private var filteredSongs: List<SongInfo> = emptyList()
    private var renderedCount = PAGE_SIZE
    private var filterJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLocalPlaylistSongManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars()
        applyInsets()
        setupHeader()
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
        binding.deleteActionText.setText(R.string.loved_songs_management_unlove)
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
            val allKeys = selectAllPlaylistSongs(filteredSongs, selectedKeys)
            selectedKeys.clear()
            selectedKeys.addAll(allKeys)
            render()
        }
        binding.invertAction.setOnClickListener {
            val nextSelected = invertPlaylistSongs(filteredSongs, selectedKeys)
            selectedKeys.clear()
            selectedKeys.addAll(nextSelected)
            render()
        }
        binding.deleteAction.setOnClickListener {
            val selectedSongs = resolveSelectedPlaylistSongs(sourceSongs, selectedKeys)
            if (selectedSongs.isEmpty()) return@setOnClickListener
            PmMinimalDialog.show(
                context = this,
                title = getString(R.string.loved_songs_management_unlove_confirm_title),
                message = getString(
                    R.string.loved_songs_management_unlove_confirm_message,
                    selectedSongs.size,
                ),
                cancelText = getString(R.string.cancel),
                confirmText = getString(R.string.dialog_ok),
                confirmColor = ContextCompat.getColor(this, R.color.pm_dialog_danger),
                onConfirm = {
                    lifecycleScope.launch {
                        val removedCount = withContext(Dispatchers.IO) {
                            loveManager.removeSongsFromLoveList(selectedSongs)
                        }
                        if (removedCount > 0) {
                            selectedKeys.clear()
                            Toast.makeText(
                                this@LovedSongsManagementActivity,
                                getString(
                                    R.string.loved_songs_management_unlove_success,
                                    removedCount,
                                ),
                                Toast.LENGTH_SHORT,
                            ).show()
                        }
                    }
                },
            )
        }
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
        adapter.submit(rendered, selectedKeys)
        binding.selectionCounterTextView.text = getString(
            R.string.local_playlist_song_management_selection_count,
            selectedKeys.size,
            sourceSongs.size,
        )
        binding.songRecyclerView.isVisible = rendered.isNotEmpty()
        binding.emptyView.isVisible = filteredSongs.isEmpty()
        binding.deleteAction.isEnabled = selectedKeys.isNotEmpty()
        binding.deleteAction.alpha = if (selectedKeys.isEmpty()) DISABLED_ACTION_ALPHA else 1f
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
            val intent = Intent(context, LovedSongsManagementActivity::class.java)
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
