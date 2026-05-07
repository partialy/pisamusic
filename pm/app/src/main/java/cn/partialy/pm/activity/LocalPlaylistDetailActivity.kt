package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.os.Bundle
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.AbsoluteSizeSpan
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.LayoutInflater
import android.widget.Toast
import android.view.View
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.annotation.OptIn
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.core.widget.ImageViewCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityPlaylistDetailBinding
import cn.partialy.pm.databinding.ItemPlaylistDetailHeaderBinding
import cn.partialy.pm.databinding.ItemPlaylistDetailStatusBinding
import cn.partialy.pm.databinding.ItemRecommendSongBinding
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.ui.mine.MinePlaylistMoreBottomSheet
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.math.max
import kotlin.math.min

/**
 * 自建本地歌单详情：与 [LovedSongsPlaylistActivity] 同套路，数据来自 [PlaylistCollectionManager]。
 */
@AndroidEntryPoint
class LocalPlaylistDetailActivity : BaseDownloadActivity() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityPlaylistDetailBinding
    private lateinit var playlistId: String
    private var miniPlayerBinder: HomeMiniPlayerBinder? = null
    private var toolbarScrollOffsetStablePx: Int = 0
    private var stickyPlayAllShown: Boolean = false

    private val listAdapter = LocalPlaylistDetailAdapter(
        onItemClick = { song, pos -> playFromSong(song, pos) },
        isSongLiked = { loveManager.isSongInLoveList(it) },
        onLoveClick = { song, _ -> loveManager.toggleLikeStatus(song) },
        onDownloadClick = { song, _ -> onDownloadClick(song) },
        onMoreClick = { song, _ -> openSongMoreMenu(song) },
    )

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityPlaylistDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        playlistId = intent.getStringExtra(EXTRA_PLAYLIST_ID).orEmpty()
        if (playlistId.isBlank()) {
            finish()
            return
        }

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = false, lightNavigationBarIcons = true)
        applyPlaylistDetailInsets()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(enabled = true) {
                override fun handleOnBackPressed() {
                    finishAnimated()
                }
            },
        )

        val baseHeaderHeightPx = (56f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
        val isDarkMode =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val insetsController = WindowInsetsControllerCompat(window, binding.root)

        fun applyStatusBarIconStyle(headerAlpha: Float) {
            if (isDarkMode) {
                insetsController.isAppearanceLightStatusBars = false
                return
            }
            insetsController.isAppearanceLightStatusBars = headerAlpha >= 0.5f
        }

        ViewCompat.setOnApplyWindowInsetsListener(binding.headerBar) { v, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            v.layoutParams = v.layoutParams.apply { height = baseHeaderHeightPx + top }
            binding.headerBarContent.updatePadding(top = top)
            insets
        }

        binding.playlistCollectButton.isVisible = false
        binding.backButton.setOnClickListener { finishAnimated() }
        binding.moreButton.setOnClickListener {
            val pl = playlistCollectionManager.getCollectedPlaylist(CollectedPlaylistType.LOCAL, playlistId)
            if (pl == null) {
                Toast.makeText(this, R.string.mine_playlist_delete_failed, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            MinePlaylistMoreBottomSheet.show(this, pl, playlistCollectionManager) {
                finishAnimated()
            }
        }

        listAdapter.onHeaderUpdated = {
            syncStickyPlayAllTrackCount()
            syncHeaderBarPlaylistTitle()
        }

        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(this@LocalPlaylistDetailActivity)
            adapter = listAdapter
            itemAnimator = null
        }

        val playAll: () -> Unit = {
            val list = listAdapter.currentSongs
            if (list.isNotEmpty()) {
                musicController.setPlayList(list)
            }
        }
        listAdapter.onPlayAllClick = playAll
        ImageViewCompat.setImageTintList(
            binding.stickyPlayAllBar.btnPlayAllSticky,
            ColorStateList.valueOf(ContextCompat.getColor(this, R.color.primary)),
        )
        binding.stickyPlayAllBar.btnPlayAllSticky.setOnClickListener { playAll() }
        binding.stickyPlayAllBar.stickyPlayAllRow.setOnClickListener { playAll() }
        syncStickyPlayAllTrackCount()
        syncHeaderBarPlaylistTitle()

        val triggerPx = (180f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
        binding.recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                val lm = recyclerView.layoutManager as? LinearLayoutManager ?: return
                val v0 = lm.findViewByPosition(0)
                val raw = if (v0 != null) {
                    (recyclerView.paddingTop - lm.getDecoratedTop(v0)).coerceAtLeast(0)
                } else {
                    recyclerView.computeVerticalScrollOffset().coerceAtLeast(0)
                }
                toolbarScrollOffsetStablePx = mergeToolbarScrollStable(
                    prev = toolbarScrollOffsetStablePx,
                    raw = raw,
                    dy = dy,
                )
                val a = (toolbarScrollOffsetStablePx.toFloat() / triggerPx).coerceIn(0f, 1f)
                val barOpaque = a >= 1f
                binding.headerBg.alpha = a
                applyStatusBarIconStyle(a)
                val iconTint = if (a < 0.5f) android.R.color.white else R.color.home_tab_unselected
                val color = ContextCompat.getColor(this@LocalPlaylistDetailActivity, iconTint)
                binding.backButton.setColorFilter(color)
                binding.moreButton.setColorFilter(color)
                binding.playlistTitleHeaderTextView.isVisible = barOpaque
                applyStickyPlayAllVisibility(barOpaque)
            }
        })
        binding.headerBg.alpha = 0f
        applyStatusBarIconStyle(0f)
        val white = ContextCompat.getColor(this, android.R.color.white)
        binding.backButton.setColorFilter(white)
        binding.moreButton.setColorFilter(white)
        binding.playlistTitleHeaderTextView.isVisible = false

        miniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@LocalPlaylistDetailActivity)
        }

        playlistCollectionManager.getAllPlaylists()

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                playlistCollectionManager.playlistsFlow.collect { playlists ->
                    val meta = playlists.find {
                        it.type == CollectedPlaylistType.LOCAL && it.id == playlistId
                    }
                    if (meta == null) {
                        finishAnimated()
                        return@collect
                    }
                    listAdapter.bindLocalHeader(
                        title = meta.name,
                        desc = meta.intro,
                        cover = meta.cover,
                    )
                    val songs = playlistCollectionManager.getLocalPlaylistSongs(playlistId)
                    listAdapter.setSongs(this@LocalPlaylistDetailActivity, songs)
                }
            }
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                loveManager.loveListFlow.collect {
                    listAdapter.notifyDataSetChanged()
                }
            }
        }
    }

    private fun openSongMoreMenu(song: SongInfo) {
        SongMoreMenu.show(
            this,
            song,
            SongMoreMenuDependencies(
                musicController = musicController,
                loveManager = loveManager,
                playlistCollectionManager = playlistCollectionManager,
                onDownloadClick = { startSongDownloadFlow(it) },
            ),
        )
    }

    private fun playFromSong(song: SongInfo, adapterPosition: Int) {
        if (adapterPosition <= 0) return
        val songs = listAdapter.currentSongs
        val idx = songs.indexOfFirst { it.id == song.id && it.type == song.type }
        if (idx < 0) return
        val queue = songs.subList(idx, songs.size).toList()
        if (queue.isEmpty()) return
        musicController.setPlayList(queue)
    }

    private fun applyStickyPlayAllVisibility(show: Boolean) {
        binding.stickyPlayAllBar.root.isVisible = show
        if (stickyPlayAllShown == show) return
        stickyPlayAllShown = show
        listAdapter.hideInlinePlayAllWhenSticky = show
        if (listAdapter.itemCount > 0) {
            binding.recyclerView.post {
                if (listAdapter.itemCount > 0) {
                    listAdapter.notifyItemChanged(0)
                }
            }
        }
    }

    private fun syncStickyPlayAllTrackCount() {
        binding.stickyPlayAllBar.trackCountTextViewSticky.text = listAdapter.headerTrackCountText
    }

    private fun syncHeaderBarPlaylistTitle() {
        binding.playlistTitleHeaderTextView.text = listAdapter.headerTitleText
    }

    private fun mergeToolbarScrollStable(prev: Int, raw: Int, dy: Int): Int {
        val d = resources.displayMetrics.density
        val slack = (28f * d).toInt().coerceAtLeast(20)
        val layoutSlack = (72f * d).toInt().coerceAtLeast(56)
        return when {
            dy < 0 -> {
                val drop = prev - raw
                if (raw < prev && drop > (-dy) + slack && (-dy) * 2 < drop) {
                    prev
                } else {
                    min(prev, raw)
                }
            }
            dy > 0 -> {
                val rise = raw - prev
                if (raw > prev && rise > dy + slack && dy * 2 < rise) {
                    prev
                } else {
                    max(prev, raw)
                }
            }
            else -> {
                when {
                    raw < prev - layoutSlack -> prev
                    raw > prev + layoutSlack -> raw
                    else -> raw
                }
            }
        }.coerceAtLeast(0)
    }

    private fun applyPlaylistDetailInsets() {
        val miniBottomBase = resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin)
        val overlapPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_overlap)
        val miniHeightPx = resources.getDimensionPixelSize(R.dimen.home_mini_player_height)
        binding.root.applySystemBarsInsets { insets ->
            val lp = binding.homeMiniPlayer.root.layoutParams as ConstraintLayout.LayoutParams
            lp.bottomMargin = miniBottomBase + overlapPx + insets.bottom
            binding.homeMiniPlayer.root.layoutParams = lp

            val listPadBottom = miniHeightPx + miniBottomBase + insets.bottom
            binding.recyclerView.updatePadding(bottom = listPadBottom)
        }
    }

    private fun finishAnimated() {
        finish()
        overridePendingTransition(R.anim.playlist_previous_scale_from_95, R.anim.slide_to_right)
    }

    override fun onDestroy() {
        miniPlayerBinder?.onDestroy()
        miniPlayerBinder = null
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_PLAYLIST_ID = "local_playlist_id"

        fun start(context: Context, playlistId: String) {
            if (playlistId.isBlank()) return
            val i = Intent(context, LocalPlaylistDetailActivity::class.java).apply {
                putExtra(EXTRA_PLAYLIST_ID, playlistId)
            }
            context.startActivity(i)
            (context as? Activity)?.overridePendingTransition(
                R.anim.slide_to_left,
                R.anim.dim_and_scale_out,
            )
        }
    }
}

private class LocalPlaylistDetailAdapter(
    private val onItemClick: (SongInfo, Int) -> Unit,
    private val isSongLiked: (SongInfo) -> Boolean,
    private val onLoveClick: (SongInfo, Int) -> Unit,
    private val onDownloadClick: (SongInfo, Int) -> Unit,
    private val onMoreClick: (SongInfo, Int) -> Unit,
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    var onPlayAllClick: (() -> Unit)? = null
    var onHeaderUpdated: (() -> Unit)? = null
    var hideInlinePlayAllWhenSticky: Boolean = false

    private var headerTitle: String = ""
    private var headerDesc: String = ""
    private var headerCover: String = ""

    val headerTitleText: String get() = headerTitle
    val headerTrackCountText: String get() = trackCountText

    private var trackCountText: String = ""
    private var songs: List<SongInfo> = emptyList()

    val currentSongs: List<SongInfo> get() = songs

    fun bindLocalHeader(title: String, desc: String, cover: String) {
        headerTitle = title
        headerDesc = desc
        headerCover = cover
        notifyItemChanged(0)
        onHeaderUpdated?.invoke()
    }

    fun setSongs(context: Context, list: List<SongInfo>) {
        songs = list
        trackCountText = if (list.isEmpty()) {
            ""
        } else {
            context.getString(R.string.mine_playlist_track_count, list.size)
        }
        notifyDataSetChanged()
        onHeaderUpdated?.invoke()
    }

    override fun getItemViewType(position: Int): Int {
        if (position == 0) return VT_HEADER
        if (songs.isEmpty()) return VT_STATUS
        return VT_SONG
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            VT_HEADER -> LocalHeaderVh(ItemPlaylistDetailHeaderBinding.inflate(inflater, parent, false))
            VT_STATUS -> StatusVh(ItemPlaylistDetailStatusBinding.inflate(inflater, parent, false))
            else -> SongVh(
                ItemRecommendSongBinding.inflate(inflater, parent, false),
                onItemClick,
                isSongLiked,
                onLoveClick,
                onDownloadClick,
                onMoreClick,
            )
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder) {
            is LocalHeaderVh -> holder.bind(
                title = headerTitle,
                desc = headerDesc,
                cover = headerCover,
                trackCountText = trackCountText,
                onPlayAllClick = onPlayAllClick,
                hidePlayAllRow = hideInlinePlayAllWhenSticky,
            )
            is StatusVh -> holder.bind(holder.itemView.context.getString(R.string.local_playlist_empty_hint))
            is SongVh -> holder.bind(
                holder.itemView.context,
                songs[position - 1],
                indexOneBased = position,
            )
        }
    }

    override fun getItemCount(): Int {
        if (songs.isEmpty()) return 2
        return 1 + songs.size
    }

    private class LocalHeaderVh(
        private val binding: ItemPlaylistDetailHeaderBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(
            title: String,
            desc: String,
            cover: String,
            trackCountText: String,
            onPlayAllClick: (() -> Unit)?,
            hidePlayAllRow: Boolean,
        ) {
            binding.playlistTitleTextView.text = title
            binding.playlistDescTextView.text = desc
            binding.trackCountTextView.text = trackCountText
            loadLocalPlaylistHeaderCovers(binding, cover)
            val playVis = if (hidePlayAllRow) View.INVISIBLE else View.VISIBLE
            binding.playAllRow.visibility = playVis
            binding.playAllRow.setOnClickListener { onPlayAllClick?.invoke() }
            binding.btnPlayAll.setOnClickListener { onPlayAllClick?.invoke() }
        }
    }

    private class StatusVh(
        private val binding: ItemPlaylistDetailStatusBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(text: String) {
            binding.statusTextView.text = text
        }
    }

    private class SongVh(
        private val binding: ItemRecommendSongBinding,
        private val onItemClick: (SongInfo, Int) -> Unit,
        private val isSongLiked: (SongInfo) -> Boolean,
        private val onLoveClick: (SongInfo, Int) -> Unit,
        private val onDownloadClick: (SongInfo, Int) -> Unit,
        private val onMoreClick: (SongInfo, Int) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(context: Context, song: SongInfo, indexOneBased: Int) {
            binding.songNameTextView.text = buildLocalPlaylistSongNameLine(context, indexOneBased, song.name)
            binding.singerTextView.text = song.artist
            SongSourceTagBinder.bind(binding.songSourceTagTextView, song.type)
            binding.coverImageView.load(song.coverUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
            binding.btnLove.visibility = View.VISIBLE
            binding.btnDownload.visibility = View.VISIBLE
            binding.btnMore.visibility = View.VISIBLE
            val liked = isSongLiked(song)
            binding.btnLove.setImageResource(if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24)
            binding.btnLove.imageTintList = ContextCompat.getColorStateList(
                context,
                if (liked) R.color.red else R.color.home_tab_unselected,
            )
            binding.root.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos != RecyclerView.NO_POSITION) onItemClick(song, pos)
            }
            binding.btnLove.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos != RecyclerView.NO_POSITION) onLoveClick(song, pos)
            }
            binding.btnDownload.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos != RecyclerView.NO_POSITION) onDownloadClick(song, pos)
            }
            binding.btnMore.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos != RecyclerView.NO_POSITION) onMoreClick(song, pos)
            }
        }
    }

    private companion object {
        private const val VT_HEADER = 1
        private const val VT_SONG = 2
        private const val VT_STATUS = 3
    }
}

private fun loadLocalPlaylistHeaderCovers(
    binding: ItemPlaylistDetailHeaderBinding,
    cover: String,
) {
    MinePlaylistCoverResolver.localTemplateRes(cover)?.let { res ->
        binding.coverImageView.load(res) {
            crossfade(true)
            placeholder(res)
            error(res)
        }
        binding.headerBgImageView.load(res) {
            crossfade(true)
            placeholder(res)
            error(res)
        }
        binding.headerBlurImageView.load(res) {
            crossfade(true)
            placeholder(res)
            error(res)
        }
    } ?: MinePlaylistCoverResolver.localFileForCover(cover)?.let { file ->
        val ph = MinePlaylistCoverResolver.defaultLocalCoverRes()
        binding.coverImageView.load(file) {
            crossfade(true)
            placeholder(ph)
            error(ph)
        }
        binding.headerBgImageView.load(file) {
            crossfade(true)
            placeholder(ph)
            error(ph)
        }
        binding.headerBlurImageView.load(file) {
            crossfade(true)
            placeholder(ph)
            error(ph)
        }
    } ?: run {
        val url = cover.trim()
        if (url.startsWith("http://") || url.startsWith("https://")) {
            val ph = MinePlaylistCoverResolver.defaultLocalCoverRes()
            binding.coverImageView.load(url) {
                crossfade(true)
                placeholder(ph)
                error(ph)
            }
            binding.headerBgImageView.load(url) {
                crossfade(true)
                placeholder(ph)
                error(ph)
            }
            binding.headerBlurImageView.load(url) {
                crossfade(true)
                placeholder(ph)
                error(ph)
            }
        } else {
            val res = MinePlaylistCoverResolver.defaultLocalCoverRes()
            binding.coverImageView.load(res) {
                crossfade(true)
                placeholder(res)
                error(res)
            }
            binding.headerBgImageView.load(res) {
                crossfade(true)
                placeholder(res)
                error(res)
            }
            binding.headerBlurImageView.load(res) {
                crossfade(true)
                placeholder(res)
                error(res)
            }
        }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        binding.headerBlurImageView.setRenderEffect(
            RenderEffect.createBlurEffect(220f, 220f, Shader.TileMode.CLAMP),
        )
    } else {
        binding.headerBlurImageView.setRenderEffect(null)
    }
}

private val localPlaylistTrailingParenInTitle = Regex("\\([^)]*\\)\\s*$")

private fun splitLocalPlaylistTrailingParenTitle(title: String): Pair<String, String?> {
    val t = title.trimEnd()
    val m = localPlaylistTrailingParenInTitle.find(t) ?: return t to null
    val main = t.substring(0, m.range.first).trimEnd()
    return if (main.isEmpty()) t to null else main to m.value.trim()
}

private fun buildLocalPlaylistSongNameLine(context: Context, indexOneBased: Int, title: String): CharSequence {
    val dm = context.resources.displayMetrics
    fun sp(spVal: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, spVal, dm).toInt()
    val secondary = ContextCompat.getColor(context, R.color.text_secondary)
    val b = SpannableStringBuilder()
    val indexPart = "$indexOneBased. "
    val iStart = b.length
    b.append(indexPart)
    b.setSpan(ForegroundColorSpan(secondary), iStart, b.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    b.setSpan(AbsoluteSizeSpan(sp(12f), false), iStart, b.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)

    val (main, paren) = splitLocalPlaylistTrailingParenTitle(title)
    b.append(main)
    if (paren != null) {
        val pStart = b.length
        b.append(paren)
        b.setSpan(ForegroundColorSpan(secondary), pStart, b.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        b.setSpan(AbsoluteSizeSpan(sp(13f), false), pStart, b.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
    return b
}
