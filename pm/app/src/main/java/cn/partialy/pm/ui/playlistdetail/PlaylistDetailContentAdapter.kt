package cn.partialy.pm.ui.playlistdetail

import android.content.Context
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.AbsoluteSizeSpan
import android.text.style.ForegroundColorSpan
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.annotation.StringRes
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemPlaylistDetailStatusBinding
import cn.partialy.pm.databinding.ItemRecommendSongBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

class PlaylistDetailContentAdapter(
    private val onSongClick: (SongInfo) -> Unit,
    private val isSongLiked: (SongInfo) -> Boolean,
    private val onLoveClick: (SongInfo) -> Unit,
    private val onDownloadClick: (SongInfo) -> Unit,
    private val onMoreClick: (SongInfo) -> Unit,
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    val currentSongs: List<SongInfo>
        get() = allSongs

    private var allSongs: List<SongInfo> = emptyList()
    private var visibleRows: List<PlaylistDetailSongRow> = emptyList()
    private var query: String = ""
    private var phase: Phase = Phase.InitialLoading
    private var hasMore: Boolean = false
    private var loadingMore: Boolean = false
    @StringRes
    private var emptyMessageRes: Int = R.string.no_data

    private enum class Phase {
        InitialLoading,
        FirstError,
        Empty,
        Content,
    }

    fun setSearchQuery(rawQuery: String) {
        val normalized = rawQuery.trim()
        if (query == normalized) return
        query = normalized
        rebuildRows()
    }

    fun setStaticSongs(songs: List<SongInfo>, @StringRes emptyMessageRes: Int) {
        this.emptyMessageRes = emptyMessageRes
        allSongs = songs
        phase = if (songs.isEmpty()) Phase.Empty else Phase.Content
        hasMore = false
        loadingMore = false
        rebuildRows()
    }

    fun showInitialLoading() {
        phase = Phase.InitialLoading
        allSongs = emptyList()
        hasMore = false
        loadingMore = false
        rebuildRows()
    }

    fun setFirstPageFailed() {
        phase = Phase.FirstError
        allSongs = emptyList()
        hasMore = false
        loadingMore = false
        rebuildRows()
    }

    fun setFirstPageSuccess(
        rows: List<SongInfo>,
        apiTotal: Int,
        apiPage: Int,
        apiPageSize: Int,
    ) {
        allSongs = rows
        phase = if (rows.isEmpty()) Phase.Empty else Phase.Content
        hasMore = hasMoreFromApiPagination(apiTotal, apiPage, apiPageSize, rows.size)
        loadingMore = false
        rebuildRows()
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
            rebuildRows()
            return
        }
        val existing = allSongs.mapTo(hashSetOf()) { it.type to it.id }
        val appended = rows.filter { (it.type to it.id) !in existing }
        if (appended.isEmpty()) {
            hasMore = false
            rebuildRows()
            return
        }
        allSongs = allSongs + appended
        phase = Phase.Content
        hasMore = hasMoreFromApiPagination(apiTotal, apiPage, apiPageSize, rows.size)
        rebuildRows()
    }

    fun replaceAllSongs(songs: List<SongInfo>) {
        allSongs = songs
        phase = if (songs.isEmpty()) Phase.Empty else Phase.Content
        hasMore = false
        loadingMore = false
        rebuildRows()
    }

    fun canLoadMore(): Boolean = phase == Phase.Content && hasMore && !loadingMore

    fun beginLoadMore(): Boolean {
        if (!canLoadMore()) return false
        loadingMore = true
        rebuildRows()
        return true
    }

    fun endLoadMoreWithoutAppend() {
        if (!loadingMore) return
        loadingMore = false
        rebuildRows()
    }

    fun notifySongChanged(song: SongInfo) {
        val index = visibleRows.indexOfFirst { row ->
            row.song.type == song.type && row.song.id == song.id
        }
        if (index >= 0) notifyItemChanged(index)
    }

    private fun rebuildRows() {
        visibleRows = if (phase == Phase.Content) {
            filterPlaylistSongRows(allSongs, query)
        } else {
            emptyList()
        }
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

    private val showFooter: Boolean
        get() = query.isEmpty() && phase == Phase.Content &&
            (loadingMore || (!hasMore && allSongs.isNotEmpty()))

    override fun getItemViewType(position: Int): Int =
        if (position < visibleRows.size) VIEW_TYPE_SONG else VIEW_TYPE_STATUS

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == VIEW_TYPE_SONG) {
            SongViewHolder(ItemRecommendSongBinding.inflate(inflater, parent, false))
        } else {
            StatusViewHolder(ItemPlaylistDetailStatusBinding.inflate(inflater, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (holder) {
            is SongViewHolder -> holder.bind(visibleRows[position])
            is StatusViewHolder -> holder.bind(statusText(holder.itemView.context))
        }
    }

    override fun getItemCount(): Int {
        if (visibleRows.isNotEmpty()) return visibleRows.size + if (showFooter) 1 else 0
        return 1
    }

    private fun statusText(context: Context): String = when {
        query.isNotEmpty() && phase == Phase.Content -> context.getString(R.string.playlist_detail_search_empty)
        phase == Phase.InitialLoading -> context.getString(R.string.loading)
        phase == Phase.FirstError -> context.getString(R.string.no_data)
        phase == Phase.Empty -> context.getString(emptyMessageRes)
        loadingMore -> context.getString(R.string.loading)
        showFooter -> context.getString(R.string.playlist_list_end)
        else -> ""
    }

    private inner class SongViewHolder(
        private val binding: ItemRecommendSongBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(row: PlaylistDetailSongRow) {
            val song = row.song
            val context = binding.root.context
            binding.songNameTextView.text = buildSongNameLine(context, row.originalIndex + 1, song.name)
            binding.singerTextView.text = song.artist
            SongSourceTagBinder.bind(binding.songSourceTagTextView, song.type)
            val coverData = song.embeddedCoverArt ?: SongCoverUrl.getSongCover(song, SongCoverUrl.SIZE_SMALL)
            binding.coverImageView.load(coverData) {
                crossfade(true)
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
            val liked = isSongLiked(song)
            binding.btnLove.setImageResource(
                if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
            )
            binding.btnLove.imageTintList = ContextCompat.getColorStateList(
                context,
                if (liked) R.color.red else R.color.home_tab_unselected,
            )
            binding.root.setOnClickListener { onSongClick(song) }
            binding.btnLove.setOnClickListener { onLoveClick(song) }
            binding.btnDownload.setOnClickListener { onDownloadClick(song) }
            binding.btnMore.setOnClickListener { onMoreClick(song) }
        }
    }

    private class StatusViewHolder(
        private val binding: ItemPlaylistDetailStatusBinding,
    ) : RecyclerView.ViewHolder(binding.root) {
        fun bind(text: String) {
            binding.statusTextView.text = text
        }
    }

    private companion object {
        private const val VIEW_TYPE_SONG = 1
        private const val VIEW_TYPE_STATUS = 2
        private val trailingParentheses = Regex("\\([^)]*\\)\\s*$")

        private fun buildSongNameLine(context: Context, indexOneBased: Int, title: String): CharSequence {
            val displayMetrics = context.resources.displayMetrics
            fun sp(value: Float) = TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_SP,
                value,
                displayMetrics,
            ).toInt()

            val secondary = ContextCompat.getColor(context, R.color.text_secondary)
            val builder = SpannableStringBuilder()
            val indexStart = builder.length
            builder.append("$indexOneBased. ")
            builder.setSpan(
                ForegroundColorSpan(secondary),
                indexStart,
                builder.length,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            builder.setSpan(
                AbsoluteSizeSpan(sp(12f), false),
                indexStart,
                builder.length,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
            )

            val trimmed = title.trimEnd()
            val match = trailingParentheses.find(trimmed)
            if (match == null) {
                builder.append(trimmed)
                return builder
            }
            val main = trimmed.substring(0, match.range.first).trimEnd()
            if (main.isEmpty()) {
                builder.append(trimmed)
                return builder
            }
            builder.append(main)
            val parenthesisStart = builder.length
            builder.append(match.value.trim())
            builder.setSpan(
                ForegroundColorSpan(secondary),
                parenthesisStart,
                builder.length,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            builder.setSpan(
                AbsoluteSizeSpan(sp(13f), false),
                parenthesisStart,
                builder.length,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
            return builder
        }
    }
}
