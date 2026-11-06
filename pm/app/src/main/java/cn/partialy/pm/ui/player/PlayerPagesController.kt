package cn.partialy.pm.ui.player

import android.view.LayoutInflater
import android.view.View
import androidx.core.view.updatePadding
import androidx.viewpager2.widget.ViewPager2
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ActivityPlayerBinding
import cn.partialy.pm.databinding.PlayerPageCoverBinding
import cn.partialy.pm.databinding.PlayerPageLyricsBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.utils.SongCoverUrl
import coil.dispose
import coil.load

/** 仅管理页面视图，不订阅播放器，也不持有歌词下载或音频职责。 */
internal class PlayerPagesController(private val host: ActivityPlayerBinding, restoredPage: Int?) {
    private val context = host.root.context
    val cover = PlayerPageCoverBinding.inflate(LayoutInflater.from(context))
    val lyrics = PlayerPageLyricsBinding.inflate(LayoutInflater.from(context))
    private var started = false
    private var songKey: String? = null
    private val pageCallback = object : ViewPager2.OnPageChangeCallback() {
        override fun onPageSelected(position: Int) {
            host.pageIndicator.page = position
            SettingsPrefs.setPlayerPageIndex(context, position)
            updateDiscVisibility()
        }
    }

    init {
        host.playerPager.adapter = PlayerPagesAdapter(listOf(cover.root, lyrics.root))
        host.playerPager.offscreenPageLimit = 1
        host.playerPager.setCurrentItem((restoredPage ?: SettingsPrefs.getPlayerPageIndex(context)).coerceIn(0, 1), false)
        host.pageIndicator.page = host.playerPager.currentItem
        host.playerPager.registerOnPageChangeCallback(pageCallback)
        cover.coverStage.setOnClickListener { host.playerPager.setCurrentItem(1, true) }
        cover.compactLyrics.setOnClickListener { host.playerPager.setCurrentItem(1, true) }
        cover.coverImage.setImageResource(R.drawable.ic_pm_icon)
    }

    val currentPage: Int get() = host.playerPager.currentItem

    fun bindSong(song: SongInfo?) {
        val key = song?.let { "${it.type}:${it.id}" }
        val changed = key != songKey
        songKey = key
        for ((title, artist, tag) in listOf(
            Triple(cover.songTitleTextView, cover.artistTextView, cover.songSourceTagTextView),
            Triple(lyrics.songTitleTextView, lyrics.artistTextView, lyrics.songSourceTagTextView),
        )) {
            title.text = song?.name ?: context.getString(R.string.song_name)
            artist.text = song?.artist ?: context.getString(R.string.singer)
            if (song == null) SongSourceTagBinder.hide(tag)
            else SongSourceTagBinder.bind(tag, song.type, SongSourceTagBinder.Surface.ON_DARK)
        }
        cover.coverImage.load(song?.let { SongCoverUrl.getSongCoverData(it, SongCoverUrl.SIZE_XLARGE) }) {
            placeholder(R.drawable.ic_pm_icon)
            error(R.drawable.ic_pm_icon)
            fallback(R.drawable.ic_pm_icon)
            crossfade(changed)
        }
    }

    fun setTogetherActive(active: Boolean) {
        // INVISIBLE 保留标题槽高度，避免入退房间时歌词中线跳变；胶囊仍在原容器原坐标。
        lyrics.headerSongInfo.visibility = if (active) View.INVISIBLE else View.VISIBLE
        cover.root.updatePadding(top = if (active) (48 * context.resources.displayMetrics.density).toInt() else 0)
    }

    fun setPlayback(playing: Boolean) = cover.vinylDisc.setPlayback(playing)
    fun setStarted(started: Boolean) { this.started = started; updateDiscVisibility() }
    private fun updateDiscVisibility() {
        cover.vinylDisc.setActive(started && currentPage == 0)
        lyrics.karaokeLyricsView.setRenderingActive(started && currentPage == 1)
    }
    fun release() {
        setStarted(false)
        cover.coverImage.dispose()
        host.playerPager.unregisterOnPageChangeCallback(pageCallback)
        host.playerPager.adapter = null
    }
}
