package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityShareDetailBinding
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CanonicalSong
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.toSongInfo
import cn.partialy.pm.share.SharePublicData
import cn.partialy.pm.share.ShareRepository
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import coil.load
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class ShareDetailActivity : BaseActivity() {
    @Inject
    lateinit var shareRepository: ShareRepository

    private lateinit var binding: ActivityShareDetailBinding
    private var uuid: String = ""
    private var currentShare: SharePublicData? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityShareDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        binding.shareDetailRoot.applySystemBarsInsets { insets ->
            binding.shareDetailToolbar.updatePadding(top = insets.top)
            binding.shareDetailContent.updatePadding(bottom = insets.bottom)
        }
        binding.shareDetailBackButton.setOnClickListener { finish() }
        binding.shareDetailRetryButton.setOnClickListener { loadShare() }

        uuid = intent.getStringExtra(EXTRA_UUID).orEmpty()
        if (uuid.isBlank()) {
            showError(getString(R.string.share_detail_invalid), getString(R.string.share_detail_invalid_message), false)
        } else {
            loadShare()
        }
    }

    private fun loadShare() {
        showLoading()
        lifecycleScope.launch {
            runCatching { shareRepository.getPublicShare(uuid) }
                .onSuccess { renderShare(it) }
                .onFailure { error ->
                    showError(
                        getString(R.string.share_detail_invalid),
                        error.message?.takeIf { it.isNotBlank() } ?: getString(R.string.share_detail_invalid_message),
                        true,
                    )
                }
        }
    }

    private fun showLoading() {
        binding.shareDetailLoading.isVisible = true
        binding.shareDetailContent.isVisible = false
        binding.shareDetailErrorGroup.isVisible = false
    }

    private fun showError(title: String, message: String, retry: Boolean) {
        binding.shareDetailLoading.isVisible = false
        binding.shareDetailContent.isVisible = false
        binding.shareDetailErrorGroup.isVisible = true
        binding.shareDetailErrorTitle.text = title
        binding.shareDetailErrorText.text = message
        binding.shareDetailRetryButton.isVisible = retry
    }

    private fun renderShare(share: SharePublicData) {
        currentShare = share
        binding.shareDetailLoading.isVisible = false
        binding.shareDetailErrorGroup.isVisible = false
        binding.shareDetailContent.isVisible = true
        binding.shareDetailName.text = share.title
        binding.shareDetailSubtitle.text = share.description.ifBlank { sourceLabel(share.source) }
        bindCover(share.coverUrl)
        if (share.type == "playlist") {
            renderPlaylistShare(share)
        } else {
            renderSongShare(share)
        }
    }

    private fun renderSongShare(share: SharePublicData) {
        val song = share.toCanonicalSongOrNull()?.toSongInfo()
        binding.shareDetailToolbarTitle.setText(R.string.share_detail_song_title)
        binding.shareDetailPrimaryButton.setText(R.string.share_detail_play)
        binding.shareDetailSecondaryButton.setText(R.string.share_detail_favorite)
        binding.shareDetailPrimaryButton.setIconResource(R.drawable.ic_play_24)
        binding.shareDetailSecondaryButton.setIconResource(R.drawable.ic_love_24)
        binding.shareDetailInfoRow1.text = infoLine(getString(R.string.singer), share.rawString("singer").ifBlank { share.description })
        binding.shareDetailInfoRow2.text = infoLine(getString(R.string.share_detail_album), share.rawString("album"))
        binding.shareDetailInfoRow3.text = infoLine(getString(R.string.share_detail_duration), formatDuration(share.rawNumber("duration")))
        binding.shareDetailPrimaryButton.setOnClickListener {
            if (song == null || song.type == SongType.LOCAL) {
                showMessage(getString(R.string.share_detail_song_unplayable))
                return@setOnClickListener
            }
            musicController.play(song)
            showMessage(getString(R.string.share_detail_playing))
        }
        binding.shareDetailSecondaryButton.setOnClickListener {
            if (song == null) {
                showMessage(getString(R.string.share_detail_favorite_unavailable))
                return@setOnClickListener
            }
            val liked = loveManager.toggleLikeStatus(song)
            showMessage(if (liked) getString(R.string.share_detail_favorited) else getString(R.string.share_detail_unfavorited))
        }
    }

    private fun renderPlaylistShare(share: SharePublicData) {
        val playlist = share.toCanonicalPlaylistOrNull()
        binding.shareDetailToolbarTitle.setText(R.string.share_detail_playlist_title)
        binding.shareDetailPrimaryButton.setText(R.string.share_detail_open_playlist)
        binding.shareDetailSecondaryButton.setText(R.string.share_detail_copy_id)
        binding.shareDetailPrimaryButton.setIconResource(R.drawable.ic_playlist_24)
        binding.shareDetailSecondaryButton.setIconResource(R.drawable.ic_copy_24)
        binding.shareDetailInfoRow1.text = infoLine(getString(R.string.region), sourceLabel(share.source))
        binding.shareDetailInfoRow2.text = infoLine(getString(R.string.share_detail_song_count), share.rawNumber("song_count").takeIf { it > 0 }?.toInt()?.toString().orEmpty())
        binding.shareDetailInfoRow3.text = infoLine(getString(R.string.share_detail_sharer), share.sharer.username)
        binding.shareDetailPrimaryButton.setOnClickListener {
            if (playlist == null) {
                showMessage(getString(R.string.share_detail_playlist_unavailable))
                return@setOnClickListener
            }
            openPlaylist(playlist)
        }
        binding.shareDetailSecondaryButton.setOnClickListener {
            val text = share.sourceId.ifBlank { share.uuid }
            val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
            clipboard.setPrimaryClip(android.content.ClipData.newPlainText(getString(R.string.share_detail_copy_id), text))
            showMessage(getString(R.string.share_detail_id_copied))
        }
    }

    private fun openPlaylist(playlist: CanonicalPlaylist) {
        when (playlist.source.lowercase()) {
            "kg" -> PlaylistDetailActivity.start(
                this,
                playlist.id,
                playlist.name,
                playlist.cover,
                playlist.desc,
                playlist.song_count,
            )
            "wy" -> WyPlaylistDetailActivity.start(
                this,
                playlist.id,
                playlist.name,
                playlist.cover,
                playlist.desc,
                playlist.song_count,
                CollectedPlaylistType.WY,
            )
            else -> showMessage(getString(R.string.share_detail_local_playlist_only))
        }
    }

    private fun bindCover(coverUrl: String) {
        val cover = coverUrl.trim()
        if (cover.startsWith("http://") || cover.startsWith("https://")) {
            binding.shareDetailCover.load(cover) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
        } else {
            binding.shareDetailCover.setImageResource(R.drawable.ic_pm_icon)
        }
    }

    private fun SharePublicData.toCanonicalSongOrNull(): CanonicalSong? {
        val id = rawString("id").ifBlank { sourceId }
        val source = rawString("source").ifBlank { this.source }
        val name = rawString("name").ifBlank { title }
        val singer = rawString("singer").ifBlank { description }
        if (id.isBlank() || source.isBlank() || name.isBlank()) return null
        return CanonicalSong(
            id = id,
            source = source,
            urlParam = rawString("urlParam").ifBlank { id },
            name = name,
            singer = singer,
            album = rawString("album"),
            cover = coverUrl,
            duration = rawNumber("duration").toInt(),
        )
    }

    private fun SharePublicData.toCanonicalPlaylistOrNull(): CanonicalPlaylist? {
        val id = rawString("id").ifBlank { sourceId }
        val source = rawString("source").ifBlank { this.source }
        val name = rawString("name").ifBlank { title }
        if (id.isBlank() || source.isBlank() || name.isBlank()) return null
        return CanonicalPlaylist(
            id = id,
            source = source,
            name = name,
            desc = rawString("desc").ifBlank { description },
            cover = coverUrl,
            song_count = rawNumber("song_count").toInt(),
        )
    }

    private fun SharePublicData.rawString(key: String): String =
        (rawJson[key] as? String).orEmpty()

    private fun SharePublicData.rawNumber(key: String): Double =
        when (val value = rawJson[key]) {
            is Number -> value.toDouble()
            is String -> value.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }

    private fun infoLine(label: String, value: String): String =
        "$label  ${value.ifBlank { getString(R.string.account_profile_value_placeholder) }}"

    private fun formatDuration(value: Double): String {
        val raw = value.toLong()
        if (raw <= 0L) return ""
        val seconds = if (raw > 10_000L) raw / 1000L else raw
        return "%02d:%02d".format(seconds / 60L, seconds % 60L)
    }

    private fun sourceLabel(source: String): String =
        when (source.lowercase()) {
            "kg" -> getString(R.string.search_source_kg)
            "wy" -> getString(R.string.search_source_wy)
            "kw" -> getString(R.string.search_source_kw)
            "local" -> "本地音乐"
            else -> source.ifBlank { getString(R.string.account_profile_value_placeholder) }
        }

    companion object {
        private const val EXTRA_UUID = "cn.partialy.pm.extra.SHARE_UUID"

        fun start(context: Context, uuid: String) {
            val intent = Intent(context, ShareDetailActivity::class.java).apply {
                putExtra(EXTRA_UUID, uuid)
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
