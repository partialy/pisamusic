package cn.partialy.pm.ui.home

import android.animation.ObjectAnimator
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.animation.LinearInterpolator
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.PlayerActivity
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.HomeMiniPlayerBinding
import cn.partialy.pm.player.MusicController
import coil.load
import kotlinx.coroutines.launch

/**
 * Shared mini player bar (cover, title, play, queue) used on home and search.
 */
class HomeMiniPlayerBinder(
    private val activity: BaseActivity,
    private val mini: HomeMiniPlayerBinding,
    private val musicController: MusicController,
) {
    private var coverRotationAnimator: ObjectAnimator? = null

    fun setupClicks() {
        mini.miniPlayerCard.setOnClickListener { PlayerActivity.start(activity) }
        mini.miniPlayerPlayButton.setOnClickListener {
            activity.lifecycleScope.launch {
                if (musicController.currentSong.value == null) {
                    Toast.makeText(activity, "暂无可播放歌曲", Toast.LENGTH_SHORT).show()
                    return@launch
                }
                musicController.togglePlayPause()
            }
        }
        mini.miniPlayerQueueButton.setOnClickListener { PlayerActivity.start(activity) }
    }

    fun startObserving(owner: LifecycleOwner) {
        owner.lifecycleScope.launch {
            musicController.currentSong.collect { song ->
                if (song == null) {
                    mini.miniPlayerSongTitle.text = activity.getString(R.string.home_mini_player_hint)
                } else {
                    mini.miniPlayerSongTitle.text = buildSongArtistText(song.name, song.artist)
                    coverRotationAnimator?.cancel()
                    coverRotationAnimator = null
                    mini.miniPlayerCover.rotation = 0f
                    mini.miniPlayerCover.load(song.coverUrl) {
                        placeholder(R.drawable.ic_pm_icon)
                        error(R.drawable.ic_pm_icon)
                    }
                }
            }
        }
        owner.lifecycleScope.launch {
            musicController.isPlaying.collect { isPlaying ->
                val icon = if (isPlaying) R.drawable.ic_pause_24 else R.drawable.ic_play_24
                mini.miniPlayerPlayButton.setImageResource(icon)
                mini.miniPlayerPlayButton.imageTintList = ColorStateList.valueOf(
                    ContextCompat.getColor(activity, R.color.home_mini_player_title),
                )
                updateCoverRotation(isPlaying)
            }
        }
    }

    fun onDestroy() {
        coverRotationAnimator?.cancel()
        coverRotationAnimator = null
    }

    private fun updateCoverRotation(isPlaying: Boolean) {
        if (isPlaying) {
            if (coverRotationAnimator == null) {
                coverRotationAnimator = ObjectAnimator.ofFloat(
                    mini.miniPlayerCover,
                    "rotation",
                    0f,
                    360f,
                ).apply {
                    duration = 20_000L
                    repeatCount = ObjectAnimator.INFINITE
                    interpolator = LinearInterpolator()
                }
            }
            when {
                coverRotationAnimator?.isPaused == true -> coverRotationAnimator?.resume()
                coverRotationAnimator?.isStarted != true -> coverRotationAnimator?.start()
            }
        } else {
            coverRotationAnimator?.pause()
        }
    }

    private fun buildSongArtistText(songName: String, artistName: String): CharSequence {
        val separator = " - "
        val text = "$songName$separator$artistName"
        val titleColor = ContextCompat.getColor(activity, R.color.home_mini_player_title)
        val subtitleColor = ContextCompat.getColor(activity, R.color.home_mini_player_subtitle)

        return SpannableStringBuilder(text).apply {
            setSpan(ForegroundColorSpan(titleColor), 0, songName.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            setSpan(StyleSpan(Typeface.BOLD), 0, songName.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            setSpan(
                ForegroundColorSpan(subtitleColor),
                songName.length + separator.length,
                text.length,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
            )
        }
    }
}
