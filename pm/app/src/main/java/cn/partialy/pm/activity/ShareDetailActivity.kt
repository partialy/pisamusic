package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.core.view.isVisible
import androidx.core.view.updateLayoutParams
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
import cn.partialy.pm.model.toCollectedPlaylist
import cn.partialy.pm.model.toSongInfo
import cn.partialy.pm.share.SharePublicData
import cn.partialy.pm.share.ShareRepository
import cn.partialy.pm.ui.dialog.ShareBottomSheet
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import com.google.gson.Gson
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class ShareDetailActivity : BaseActivity() {
    @Inject
    lateinit var shareRepository: ShareRepository

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityShareDetailBinding
    private var uuid: String = ""
    private val gson = Gson()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityShareDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)
        val toolbarContentHeightPx = resources.getDimensionPixelSize(R.dimen.share_detail_toolbar_content_height)
        binding.shareDetailRoot.applySystemBarsInsets { insets ->
            binding.shareDetailToolbar.updateLayoutParams {
                height = toolbarContentHeightPx + insets.top
            }
            binding.shareDetailToolbar.updatePadding(top = insets.top)
            binding.shareDetailContent.updatePadding(bottom = insets.bottom)
        }
        binding.shareDetailBackButton.setOnClickListener { finish() }
        binding.shareDetailRetryButton.setOnClickListener { loadShare() }

        if (renderLocalDetailFromIntent()) {
            return
        }

        uuid = intent.getStringExtra(EXTRA_UUID).orEmpty()
        if (uuid.isBlank()) {
            showError(getString(R.string.share_detail_invalid), getString(R.string.share_detail_invalid_message), false)
        } else {
            loadShare()
        }
    }

    private fun renderLocalDetailFromIntent(): Boolean {
        val type = intent.getStringExtra(EXTRA_LOCAL_TYPE).orEmpty()
        val raw = intent.getStringExtra(EXTRA_LOCAL_JSON).orEmpty()
        if (type.isBlank() || raw.isBlank()) return false
        return runCatching {
            when (type) {
                LOCAL_TYPE_SONG -> renderLocalSong(gson.fromJson(raw, CanonicalSong::class.java))
                LOCAL_TYPE_PLAYLIST -> renderLocalPlaylist(gson.fromJson(raw, CanonicalPlaylist::class.java))
                else -> showError(getString(R.string.share_detail_invalid), getString(R.string.share_detail_invalid_message), false)
            }
        }.isSuccess
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
        binding.shareDetailLoading.isVisible = false
        binding.shareDetailErrorGroup.isVisible = false
        binding.shareDetailContent.isVisible = true
        binding.shareDetailName.text = share.title
        binding.shareDetailSubtitle.text = share.description
        bindCover(share.source, share.coverUrl)
        if (share.type == "playlist") {
            renderPlaylistShare(share)
        } else {
            renderSongShare(share)
        }
    }

    private fun renderLocalSong(song: CanonicalSong) {
        val safeSong = song.copy(
            cover = SongCoverUrl.getRemoteCover(song.source, song.cover, SongCoverUrl.SIZE_MEDIUM),
        )
        binding.shareDetailLoading.isVisible = false
        binding.shareDetailErrorGroup.isVisible = false
        binding.shareDetailContent.isVisible = true
        binding.shareDetailName.text = safeSong.name
        binding.shareDetailSubtitle.text = safeSong.singer
        bindCover(safeSong.source, safeSong.cover)
        renderSongDetail(
            song = safeSong.toSongInfo(),
            artist = safeSong.singer,
            album = safeSong.album,
            duration = safeSong.duration.toDouble(),
        )
    }

    private fun renderLocalPlaylist(playlist: CanonicalPlaylist) {
        val safePlaylist = playlist.copy(
            cover = SongCoverUrl.getRemoteCover(playlist.source, playlist.cover, SongCoverUrl.SIZE_MEDIUM),
        )
        binding.shareDetailLoading.isVisible = false
        binding.shareDetailErrorGroup.isVisible = false
        binding.shareDetailContent.isVisible = true
        binding.shareDetailName.text = safePlaylist.name
        binding.shareDetailSubtitle.text = safePlaylist.desc
        bindCover(safePlaylist.source, safePlaylist.cover)
        renderPlaylistDetail(
            playlist = safePlaylist,
            source = safePlaylist.source,
            songCount = safePlaylist.song_count,
            info3Label = getString(R.string.share_detail_id),
            info3 = safePlaylist.id,
            secondaryAction = PlaylistSecondaryAction.Share,
        )
    }

    private fun renderSongShare(share: SharePublicData) {
        val song = share.toCanonicalSongOrNull()?.toSongInfo()
        renderSongDetail(
            song = song,
            artist = share.rawString("singer").ifBlank { share.description },
            album = share.rawString("album"),
            duration = share.rawNumber("duration"),
        )
    }

    private fun renderSongDetail(
        song: SongInfo?,
        artist: String,
        album: String,
        duration: Double,
    ) {
        binding.shareDetailToolbarTitle.setText(R.string.share_detail_song_title)
        binding.shareDetailPrimaryButton.setText(R.string.share_detail_play)
        binding.shareDetailSecondaryButton.setText(R.string.share_detail_favorite)
        binding.shareDetailPrimaryButton.setIconResource(R.drawable.ic_play_24)
        binding.shareDetailSecondaryButton.setIconResource(R.drawable.ic_love_24)
        SongSourceTagBinder.hide(binding.shareDetailSourceTag)
        binding.shareDetailInfoRow1.text = infoLine(getString(R.string.singer), artist)
        binding.shareDetailInfoRow2.text = infoLine(getString(R.string.share_detail_album), album)
        binding.shareDetailInfoRow3.text = infoLine(getString(R.string.share_detail_duration), formatDuration(duration))
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
        renderPlaylistDetail(
            playlist = playlist,
            source = share.source,
            songCount = share.rawNumber("song_count").takeIf { it > 0 }?.toInt() ?: 0,
            info3Label = getString(R.string.share_detail_sharer),
            info3 = share.sharer.username,
            secondaryAction = PlaylistSecondaryAction.Favorite,
        )
    }

    private fun renderPlaylistDetail(
        playlist: CanonicalPlaylist?,
        source: String,
        songCount: Int,
        info3Label: String,
        info3: String,
        secondaryAction: PlaylistSecondaryAction,
    ) {
        binding.shareDetailToolbarTitle.setText(R.string.share_detail_playlist_title)
        binding.shareDetailPrimaryButton.setText(R.string.share_detail_open_playlist)
        binding.shareDetailPrimaryButton.setIconResource(R.drawable.ic_playlist_24)
        bindSourceTag(source)
        binding.shareDetailInfoRow2.text = infoLine(getString(R.string.share_detail_song_count), songCount.takeIf { it > 0 }?.toString().orEmpty())
        binding.shareDetailInfoRow3.text = infoLine(info3Label, info3)
        binding.shareDetailPrimaryButton.setOnClickListener {
            if (playlist == null) {
                showMessage(getString(R.string.share_detail_playlist_unavailable))
                return@setOnClickListener
            }
            openPlaylist(playlist)
        }
        when (secondaryAction) {
            PlaylistSecondaryAction.Share -> bindPlaylistShareAction(playlist)
            PlaylistSecondaryAction.Favorite -> bindPlaylistFavoriteAction(playlist)
        }
    }

    private fun bindSourceTag(source: String) {
        binding.shareDetailInfoRow1.setText(R.string.region)
        val type = when (source.trim().lowercase()) {
            "kg" -> SongType.KG
            "wy" -> SongType.WY
            "kw" -> SongType.KW
            "local" -> SongType.LOCAL
            else -> null
        }
        if (type == null) {
            SongSourceTagBinder.hide(binding.shareDetailSourceTag)
            return
        }
        SongSourceTagBinder.bind(binding.shareDetailSourceTag, type)
        binding.shareDetailSourceTag.contentDescription = sourceLabel(source)
    }

    private fun bindPlaylistShareAction(playlist: CanonicalPlaylist?) {
        binding.shareDetailSecondaryButton.setText(R.string.song_more_share)
        binding.shareDetailSecondaryButton.setIconResource(R.drawable.ic_share_24)
        binding.shareDetailSecondaryButton.setOnClickListener {
            if (playlist == null) {
                showMessage(getString(R.string.share_detail_playlist_unavailable))
                return@setOnClickListener
            }
            ShareBottomSheet.showPlaylist(this, playlist)
        }
    }

    private fun bindPlaylistFavoriteAction(playlist: CanonicalPlaylist?) {
        val normalizedSource = playlist?.source?.lowercase()
        if (playlist == null || normalizedSource !in setOf("kg", "wy")) {
            binding.shareDetailSecondaryButton.setText(R.string.share_detail_favorite)
            binding.shareDetailSecondaryButton.setIconResource(R.drawable.ic_love_24)
            binding.shareDetailSecondaryButton.setOnClickListener {
                showMessage(getString(R.string.share_detail_playlist_favorite_unavailable))
            }
            return
        }

        fun existingFavorite() = when (playlist.source.lowercase()) {
            "kg" -> playlistCollectionManager.findKgLikeCollected(playlist.id)
            "wy" -> playlistCollectionManager.findWyLikeCollected(playlist.id)
            else -> null
        }

        fun renderFavoriteState() {
            val collected = existingFavorite() != null
            binding.shareDetailSecondaryButton.setText(
                if (collected) R.string.song_more_cancel_favorite else R.string.share_detail_favorite,
            )
            binding.shareDetailSecondaryButton.setIconResource(
                if (collected) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
            )
        }

        renderFavoriteState()
        binding.shareDetailSecondaryButton.setOnClickListener {
            val existing = existingFavorite()
            val success = if (existing == null) {
                runCatching {
                    playlistCollectionManager.addNetworkPlaylist(playlist.toCollectedPlaylist())
                }.getOrDefault(false)
            } else {
                playlistCollectionManager.removePlaylist(existing.type, existing.id)
            }
            val message = when {
                !success && existing == null -> R.string.playlist_more_favorite_failed
                !success -> R.string.playlist_more_unfavorite_failed
                existing == null -> R.string.share_detail_favorited
                else -> R.string.share_detail_unfavorited
            }
            showMessage(getString(message))
            renderFavoriteState()
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
            "local" -> LocalPlaylistDetailActivity.start(this, playlist.id)
            else -> showMessage(getString(R.string.share_detail_local_playlist_only))
        }
    }

    private fun bindCover(source: String, coverUrl: String) {
        val cover = SongCoverUrl.getRemoteCover(source, coverUrl, SongCoverUrl.SIZE_MEDIUM)
        if (cover.isNotBlank()) {
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
            cover = SongCoverUrl.getRemoteCover(source, coverUrl, SongCoverUrl.SIZE_MEDIUM),
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
            cover = SongCoverUrl.getRemoteCover(source, coverUrl, SongCoverUrl.SIZE_MEDIUM),
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
            "local" -> getString(R.string.source_local_music)
            else -> source.ifBlank { getString(R.string.account_profile_value_placeholder) }
        }

    private enum class PlaylistSecondaryAction {
        Share,
        Favorite,
    }

    companion object {
        private const val EXTRA_UUID = "cn.partialy.pm.extra.SHARE_UUID"
        private const val EXTRA_LOCAL_TYPE = "cn.partialy.pm.extra.SHARE_LOCAL_TYPE"
        private const val EXTRA_LOCAL_JSON = "cn.partialy.pm.extra.SHARE_LOCAL_JSON"
        private const val LOCAL_TYPE_SONG = "song"
        private const val LOCAL_TYPE_PLAYLIST = "playlist"
        private val intentGson = Gson()

        fun start(context: Context, uuid: String) {
            val intent = Intent(context, ShareDetailActivity::class.java).apply {
                putExtra(EXTRA_UUID, uuid)
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }

        fun startSongDetail(context: Context, song: CanonicalSong) {
            val intent = Intent(context, ShareDetailActivity::class.java).apply {
                putExtra(EXTRA_LOCAL_TYPE, LOCAL_TYPE_SONG)
                putExtra(EXTRA_LOCAL_JSON, intentGson.toJson(song))
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }

        fun startPlaylistDetail(context: Context, playlist: CanonicalPlaylist) {
            val intent = Intent(context, ShareDetailActivity::class.java).apply {
                putExtra(EXTRA_LOCAL_TYPE, LOCAL_TYPE_PLAYLIST)
                putExtra(EXTRA_LOCAL_JSON, intentGson.toJson(playlist))
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
