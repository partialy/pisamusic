package cn.partialy.pm.ui.dialog

import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.R
import cn.partialy.pm.activity.ShareDetailActivity
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.toCanonicalSong
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager

data class SongMoreMenuDependencies(
    val musicController: MusicController,
    val loveManager: LoveManager,
    val playlistCollectionManager: PlaylistCollectionManager,
    val onDownloadClick: (SongInfo) -> Unit,
    val showShare: Boolean = true,
    val showPlayNext: Boolean = true,
    val showDownload: Boolean = true,
    val allowQueueTarget: Boolean = true,
    val onShareClick: ((SongInfo) -> Unit)? = null,
    val onListenTogetherClick: ((SongInfo) -> Unit)? = null,
)

/**
 * 歌曲「更多」：下一首播放、下载、收藏、添加到自建歌单。
 */
object SongMoreMenu {

    fun show(activity: FragmentActivity, song: SongInfo, deps: SongMoreMenuDependencies) {
        val liked = deps.loveManager.isSongInLoveList(song)
        val actions = buildList {
            if (deps.showPlayNext && song.playable) {
                add(ActionMenuItem(R.drawable.ic_next_24, activity.getString(R.string.song_more_play_next)) {
                    deps.musicController.addPlayNext(song)
                    PmMessage.success(activity, R.string.toast_song_added_to_play_next)
                })
            }
            if (deps.showDownload && song.playable && song.type != SongType.LOCAL) {
                add(ActionMenuItem(R.drawable.ic_download_24, activity.getString(R.string.song_more_download)) {
                    deps.onDownloadClick(song)
                })
            }
            add(ActionMenuItem(
                iconRes = if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
                text = activity.getString(
                    if (liked) R.string.song_more_cancel_favorite else R.string.song_more_favorite,
                ),
                colorRes = if (liked) R.color.red else null,
            ) {
                val liked = deps.loveManager.toggleLikeStatus(song)
                PmMessage.success(activity, activity.getString(if (liked) R.string.share_favorited else R.string.share_unfavorited))
            })
            add(ActionMenuItem(
                R.drawable.ic_playlist_24,
                activity.getString(R.string.song_more_add_to_playlist),
            ) {
                var newPlaylistCreated = false
                AddToPlaylistBottomSheet.show(
                    activity,
                    listOf(song),
                    deps.musicController,
                    deps.playlistCollectionManager,
                    allowQueueTarget = deps.allowQueueTarget && song.playable,
                    onNewPlaylistCreated = { newPlaylistCreated = true },
                    onResult = { result ->
                        if (newPlaylistCreated && result.added.size == 1 && result.failed.isEmpty()) {
                            PmMessage.success(activity, R.string.local_playlist_created_song_added)
                        } else {
                            val message = activity.getString(R.string.online_batch_add_result, result.added.size, result.existing.size, result.failed.size)
                            if (result.failed.isNotEmpty()) PmMessage.warning(activity, message)
                            else PmMessage.success(activity, message)
                        }
                    },
                )
            })
            deps.onListenTogetherClick?.let { onListenTogetherClick ->
                add(ActionMenuItem(
                    R.drawable.ic_listen_together_24,
                    activity.getString(R.string.listen_together_title),
                ) {
                    onListenTogetherClick(song)
                })
            }
            add(ActionMenuItem(
                R.drawable.ic_info_24,
                activity.getString(R.string.song_more_detail),
            ) {
                ShareDetailActivity.startSongDetail(activity, song.toCanonicalSong())
            })
            if (deps.showShare && song.type != SongType.LOCAL) {
                add(ActionMenuItem(
                    R.drawable.ic_share_24,
                    activity.getString(R.string.song_more_share),
                ) {
                    deps.onShareClick?.invoke(song) ?: ShareBottomSheet.showSong(activity, song)
                })
            }
        }

        ActionMenuBottomSheet.show(
            activity = activity,
            items = actions,
            bindHeader = { root -> SongInfoHeaderBinder.bind(root, song) },
        )
    }

}
