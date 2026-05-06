package cn.partialy.pm.activity

import android.content.Context
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.AbsoluteSizeSpan
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemPlaylistDetailHeaderBinding
import cn.partialy.pm.databinding.ItemPlaylistDetailStatusBinding
import cn.partialy.pm.databinding.ItemRecommendSongBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import coil.load

/** 酷狗 / 网易云歌单详情共用列表（头图 + 歌曲 + 加载态），布局见 [R.layout.activity_playlist_detail]。 */
class PlaylistDetailListAdapter(
    private val onItemClick: (SongInfo, Int) -> Unit,
    private val isSongLiked: (SongInfo) -> Boolean,
    private val onLoveClick: (SongInfo, Int) -> Unit,
    private val onDownloadClick: (SongInfo, Int) -> Unit,
    private val onMoreClick: (SongInfo, Int) -> Unit,
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    var onPlayAllClick: (() -> Unit)? = null
    var onHeaderUpdated: (() -> Unit)? = null

    val headerTrackCountText: String
        get() = header.trackCountText

    val headerTitleText: String
        get() = header.title

    val headerDescText: String
        get() = header.desc

    val headerCoverUrl: String
        get() = header.coverUrl

    var hideInlinePlayAllWhenSticky: Boolean = false

    private var header: Header = Header()

    val currentSongs: List<SongInfo>
        get() = songs

    private var songs: List<SongInfo> = emptyList()
    private var phase: Phase = Phase.InitialLoading
    private var hasMore: Boolean = false
    private var loadingMore: Boolean = false

    private enum class Phase {
        InitialLoading,
        FirstError,
        Empty,
        Content,
    }

    fun updateHeader(
        title: String? = null,
        desc: String? = null,
        coverUrl: String? = null,
        trackCountText: String? = null,
    ) {
        header = header.copy(
            title = title ?: header.title,
            desc = desc ?: header.desc,
            coverUrl = coverUrl ?: header.coverUrl,
            trackCountText = trackCountText ?: header.trackCountText,
        )
        notifyItemChanged(0)
        onHeaderUpdated?.invoke()
    }

    fun showInitialLoading() {
        phase = Phase.InitialLoading
        songs = emptyList()
        hasMore = false
        loadingMore = false
        notifyDataSetChanged()
    }

    fun setFirstPageFailed() {
        phase = Phase.FirstError
        songs = emptyList()
        hasMore = false
        loadingMore = false
        notifyDataSetChanged()
    }

    fun setFirstPageSuccess(
        rows: List<SongInfo>,
        apiTotal: Int,
        apiPage: Int,
        apiPageSize: Int,
    ) {
        if (rows.isEmpty()) {
            phase = Phase.Empty
            songs = emptyList()
            hasMore = false
            loadingMore = false
            notifyDataSetChanged()
            return
        }
        phase = Phase.Content
        songs = rows
        hasMore = hasMoreFromApiPagination(apiTotal, apiPage, apiPageSize, rows.size)
        loadingMore = false
        notifyDataSetChanged()
    }

    private fun hasMoreFromApiPagination(
        apiTotal: Int,
        apiPage: Int,
        apiPageSize: Int,
        rowsReturned: Int,
    ): Boolean {
        if (rowsReturned == 0) return false
        val page = apiPage.coerceAtLeast(1)
        val pageSize = apiPageSize.coerceAtLeast(1)
        return if (apiTotal > 0) {
            page.toLong() * pageSize < apiTotal
        } else {
            rowsReturned >= pageSize
        }
    }

    fun canLoadMore(): Boolean =
        phase == Phase.Content && hasMore && !loadingMore

    fun beginLoadMore(): Boolean {
        if (!canLoadMore()) return false
        loadingMore = true
        notifyDataSetChanged()
        return true
    }

    fun endLoadMoreWithoutAppend() {
        loadingMore = false
        notifyDataSetChanged()
    }

    fun appendFromApi(
        rows: List<SongInfo>,
        apiTotal: Int,
        apiPage: Int,
        apiPageSize: Int,
    ) {
        loadingMore = false
        if (rows.isEmpty()) {
            hasMore = false
            notifyDataSetChanged()
            return
        }
        val existing = songs.map { it.id }.toHashSet()
        val appended = rows.filter { it.id !in existing }
        if (appended.isEmpty()) {
            hasMore = false
            notifyDataSetChanged()
            return
        }
        val insertStart = songs.size + 1
        songs = songs + appended
        hasMore = hasMoreFromApiPagination(apiTotal, apiPage, apiPageSize, rows.size)
        notifyItemRangeInserted(insertStart, appended.size)
    }

    /** 用全量数据替换列表（首次30首后拿到全量时调用） */
    fun replaceAllSongs(allSongs: List<SongInfo>) {
        val oldSize = songs.size
        songs = allSongs
        hasMore = false
        loadingMore = false
        if (allSongs.size > oldSize) {
            notifyItemRangeInserted(oldSize + 1, allSongs.size - oldSize)
        } else {
            notifyDataSetChanged()
        }
    }

    private val showFooter: Boolean
        get() = phase == Phase.Content &&
            (loadingMore || (!hasMore && songs.isNotEmpty()))

    override fun getItemViewType(position: Int): Int {
        if (position == 0) return VT_HEADER
        return when (phase) {
            Phase.InitialLoading, Phase.FirstError, Phase.Empty -> VT_STATUS
            Phase.Content -> {
                if (position <= songs.size) VT_SONG else VT_STATUS
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            VT_HEADER -> HeaderVh(ItemPlaylistDetailHeaderBinding.inflate(inflater, parent, false))
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
            is HeaderVh -> holder.bind(header, onPlayAllClick, hideInlinePlayAllWhenSticky)
            is StatusVh -> holder.bind(statusText(holder.itemView.context, position))
            is SongVh -> holder.bind(
                holder.itemView.context,
                songs[position - 1],
                indexOneBased = position,
            )
        }
    }

    private fun statusText(ctx: android.content.Context, position: Int): String {
        val res = ctx.resources
        return when (phase) {
            Phase.InitialLoading -> res.getString(R.string.loading)
            Phase.FirstError, Phase.Empty -> res.getString(R.string.no_data)
            Phase.Content -> {
                if (position == itemCount - 1 && showFooter) {
                    if (loadingMore) res.getString(R.string.loading)
                    else res.getString(R.string.playlist_list_end)
                } else ""
            }
        }
    }

    override fun getItemCount(): Int {
        val body = when (phase) {
            Phase.InitialLoading, Phase.FirstError, Phase.Empty -> 1
            Phase.Content -> songs.size + if (showFooter) 1 else 0
        }
        return 1 + body
    }

    class HeaderVh(
        private val binding: ItemPlaylistDetailHeaderBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(h: Header, onPlayAllClick: (() -> Unit)?, hidePlayAllRow: Boolean) {
            val coverForBg = h.coverUrl.replace("{size}", "240")
            val coverForRow = h.coverUrl.replace("{size}", "240")
            binding.playlistTitleTextView.text = h.title
            binding.playlistDescTextView.text = h.desc
            binding.trackCountTextView.text = h.trackCountText
            binding.coverImageView.load(coverForRow) {
                crossfade(true)
                placeholder(R.drawable.ic_playlist_24)
                error(R.drawable.ic_playlist_24)
            }
            binding.headerBgImageView.load(coverForBg) {
                crossfade(true)
                placeholder(R.drawable.bg_mine_header)
                error(R.drawable.bg_mine_header)
            }
            binding.headerBlurImageView.load(coverForBg) {
                crossfade(true)
                placeholder(R.drawable.bg_mine_header)
                error(R.drawable.bg_mine_header)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                binding.headerBlurImageView.setRenderEffect(
                    RenderEffect.createBlurEffect(220f, 220f, Shader.TileMode.CLAMP),
                )
            } else {
                binding.headerBlurImageView.setRenderEffect(null)
            }
            val playVis = if (hidePlayAllRow) View.INVISIBLE else View.VISIBLE
            binding.playAllRow.visibility = playVis
            binding.playAllRow.setOnClickListener { onPlayAllClick?.invoke() }
            binding.btnPlayAll.setOnClickListener { onPlayAllClick?.invoke() }
        }
    }

    class StatusVh(
        private val binding: ItemPlaylistDetailStatusBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(text: String) {
            binding.statusTextView.text = text
        }
    }

    class SongVh(
        private val binding: ItemRecommendSongBinding,
        private val onItemClick: (SongInfo, Int) -> Unit,
        private val isSongLiked: (SongInfo) -> Boolean,
        private val onLoveClick: (SongInfo, Int) -> Unit,
        private val onDownloadClick: (SongInfo, Int) -> Unit,
        private val onMoreClick: (SongInfo, Int) -> Unit,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(context: Context, song: SongInfo, indexOneBased: Int) {
            binding.songNameTextView.text = buildPlaylistDetailSongNameLine(context, indexOneBased, song.name)
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

    data class Header(
        val title: String = "歌单",
        val desc: String = "",
        val coverUrl: String = "",
        val trackCountText: String = "",
    )

    private companion object {
        private const val VT_HEADER = 1
        private const val VT_SONG = 2
        private const val VT_STATUS = 3
    }
}

private val playlistDetailTrailingParenInTitle = Regex("\\([^)]*\\)\\s*$")

private fun splitTrailingParenTitle(title: String): Pair<String, String?> {
    val t = title.trimEnd()
    val m = playlistDetailTrailingParenInTitle.find(t) ?: return t to null
    val main = t.substring(0, m.range.first).trimEnd()
    return if (main.isEmpty()) t to null else main to m.value.trim()
}

private fun buildPlaylistDetailSongNameLine(context: Context, indexOneBased: Int, title: String): CharSequence {
    val dm = context.resources.displayMetrics
    fun sp(spVal: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, spVal, dm).toInt()
    val secondary = ContextCompat.getColor(context, R.color.text_secondary)
    val b = SpannableStringBuilder()
    val indexPart = "$indexOneBased. "
    val iStart = b.length
    b.append(indexPart)
    b.setSpan(ForegroundColorSpan(secondary), iStart, b.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    b.setSpan(AbsoluteSizeSpan(sp(12f), false), iStart, b.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)

    val (main, paren) = splitTrailingParenTitle(title)
    b.append(main)
    if (paren != null) {
        val pStart = b.length
        b.append(paren)
        b.setSpan(ForegroundColorSpan(secondary), pStart, b.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        b.setSpan(AbsoluteSizeSpan(sp(13f), false), pStart, b.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
    return b
}
