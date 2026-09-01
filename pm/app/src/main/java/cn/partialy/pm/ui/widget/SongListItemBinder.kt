package cn.partialy.pm.ui.widget

import android.content.res.ColorStateList
import android.view.View
import android.widget.ImageButton
import androidx.core.content.ContextCompat
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemSongListBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.SongCoverUrl
import coil.load

/** 歌曲行中可按页面需要隐藏或禁用的操作。 */
data class SongListItemOptions(
    val showLove: Boolean = true,
    val showDownload: Boolean = true,
    val showMore: Boolean = true,
    val enabled: Boolean = true,
)

/** 歌曲行的操作回调；未提供的回调会移除对应 View 的旧监听。 */
data class SongListItemActions(
    val onClick: ((SongInfo) -> Unit)? = null,
    val onLoveClick: ((SongInfo) -> Unit)? = null,
    val onDownloadClick: ((SongInfo) -> Unit)? = null,
    val onMoreClick: ((SongInfo) -> Unit)? = null,
)

/** 当前播放歌曲及其播放状态。 */
data class SongListPlaybackState(
    val currentSong: SongInfo? = null,
    val isPlaying: Boolean = false,
) {
    /** 以音源和歌曲 ID 判断歌曲是否为当前歌曲。 */
    fun isCurrent(song: SongInfo): Boolean = currentSong?.let {
        it.type == song.type && it.id == song.id
    } ?: false
}

/**
 * 统一歌曲行的 ViewBinding 封装，负责将每次绑定完整还原，避免 RecyclerView 复用残留。
 */
class SongListItemBinder(private val binding: ItemSongListBinding) {

    private val normalSongNameColor: ColorStateList = binding.songNameTextView.textColors
    private val normalSingerColor: ColorStateList = binding.singerTextView.textColors

    /**
     * 绑定一首歌曲及其页面特有展示状态。
     *
     * @param displayTitle 非空时替换默认歌名展示。
     * @param displayArtist 非空时替换默认歌手展示。
     */
    fun bind(
        song: SongInfo,
        displayTitle: CharSequence? = null,
        displayArtist: CharSequence? = null,
        liked: Boolean = false,
        options: SongListItemOptions = SongListItemOptions(),
        playbackState: SongListPlaybackState = SongListPlaybackState(),
        actions: SongListItemActions = SongListItemActions(),
    ) = with(binding) {
        val isCurrent = playbackState.isCurrent(song)
        val context = root.context

        songNameTextView.text = displayTitle ?: song.name
        singerTextView.text = displayArtist ?: song.artist
        applyTextColors(isCurrent)
        SongSourceTagBinder.bind(songSourceTagTextView, song.type)
        coverImageView.load(SongCoverUrl.getSongCoverData(song, SongCoverUrl.SIZE_SMALL)) {
            crossfade(true)
            placeholder(R.drawable.ic_pm_icon)
            error(R.drawable.ic_pm_icon)
        }

        currentSongCoverMask.visibility = if (isCurrent) View.VISIBLE else View.GONE
        playingSpectrumView.setPlaybackState(isCurrent, playbackState.isPlaying)

        btnLove.visibility = if (options.showLove) View.VISIBLE else View.GONE
        btnDownload.visibility = if (options.showDownload) View.VISIBLE else View.GONE
        btnMore.visibility = if (options.showMore) View.VISIBLE else View.GONE
        val normalActionTint = ContextCompat.getColorStateList(context, R.color.home_tab_unselected)
        btnLove.setImageResource(if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24)
        btnLove.imageTintList = if (liked) {
            ContextCompat.getColorStateList(context, R.color.red)
        } else {
            normalActionTint
        }
        btnDownload.imageTintList = normalActionTint
        btnMore.imageTintList = normalActionTint

        root.alpha = if (options.enabled) ENABLED_ALPHA else DISABLED_ALPHA
        bindAction(root, song, options.enabled, actions.onClick)
        bindAction(btnLove, song, options.enabled && options.showLove, actions.onLoveClick)
        bindAction(btnDownload, song, options.enabled && options.showDownload, actions.onDownloadClick)
        bindAction(btnMore, song, options.enabled && options.showMore, actions.onMoreClick)
    }

    private fun applyTextColors(isCurrent: Boolean) = with(binding) {
        if (isCurrent) {
            val primary = ContextCompat.getColor(root.context, R.color.primary)
            songNameTextView.setTextColor(primary)
            singerTextView.setTextColor(primary)
        } else {
            songNameTextView.setTextColor(normalSongNameColor)
            singerTextView.setTextColor(normalSingerColor)
        }
    }

    private fun bindAction(
        view: View,
        song: SongInfo,
        allowed: Boolean,
        action: ((SongInfo) -> Unit)?,
    ) {
        view.setOnClickListener(null)
        val enabled = allowed && action != null
        view.isEnabled = enabled
        if (view is ImageButton) {
            view.alpha = if (enabled) ENABLED_ALPHA else DISABLED_BUTTON_ALPHA
        }
        if (enabled) view.setOnClickListener { action?.invoke(song) }
    }

    private companion object {
        const val ENABLED_ALPHA = 1f
        const val DISABLED_ALPHA = 0.56f
        const val DISABLED_BUTTON_ALPHA = 0.4f
    }
}
