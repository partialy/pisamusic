package cn.partialy.pm.ui.cloudmusic

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import cn.partialy.pm.R
import cn.partialy.pm.activity.CloudMusicSearchActivity
import cn.partialy.pm.activity.CloudMusicSubmissionActivity
import cn.partialy.pm.activity.MainActivity
import cn.partialy.pm.databinding.FragmentCloudMusicBinding
import cn.partialy.pm.databinding.ItemRecommendSongBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import dagger.hilt.android.AndroidEntryPoint
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@AndroidEntryPoint
class CloudMusicFragment : Fragment() {

    @Inject
    lateinit var musicController: MusicController

    @Inject
    lateinit var loveManager: LoveManager

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private var _binding: FragmentCloudMusicBinding? = null
    private val binding get() = _binding!!
    private val viewModel: CloudMusicViewModel by viewModels()
    private var currentRecentSongs: List<SongInfo> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentCloudMusicBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupActions()
        observeState()
    }

    private fun setupActions() = with(binding) {
        cloudMusicSearchCard.setOnClickListener {
            CloudMusicSearchActivity.start(requireContext())
        }

        cloudMusicSubmitCard.setOnClickListener {
            CloudMusicSubmissionActivity.start(requireContext())
        }

        cloudMusicViewAllButton.setOnClickListener {
            CloudMusicSearchActivity.start(requireContext())
        }

        cloudMusicRecentRetryButton.setOnClickListener {
            viewModel.retryFirstPage()
        }

        cloudMusicSwipeRefresh.setOnRefreshListener(viewModel::refresh)
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.state.collectLatest { state ->
                        binding.cloudMusicSwipeRefresh.isRefreshing = state.refreshing

                        binding.cloudMusicTotalSongsText.text = state.total.toString()
                        binding.cloudMusicMyContributionsText.text = state.myContributions.toString()

                        val dateStr = state.latestUpdatedAt?.let {
                            val pattern = getString(R.string.cloud_music_date_pattern_short)
                            SimpleDateFormat(pattern, Locale.getDefault()).format(Date(it))
                        } ?: getString(R.string.cloud_music_no_update_short)
                        binding.cloudMusicLatestUpdateText.text = dateStr

                        renderRecentSongs(state)
                    }
                }

                launch {
                    loveManager.loveListFlow.collectLatest {
                        if (currentRecentSongs.isNotEmpty()) {
                            bindRecentSongsContainer(currentRecentSongs)
                        }
                    }
                }
            }
        }
    }

    private fun renderRecentSongs(state: CloudMusicUiState) = with(binding) {
        val recentList = state.items.take(MAX_RECENT_PREVIEW_COUNT)
        currentRecentSongs = recentList

        cloudMusicRecentProgress.isVisible = state.initialLoading && recentList.isEmpty()
        cloudMusicRecentErrorLayout.isVisible = state.error != null && recentList.isEmpty()
        cloudMusicRecentEmptyText.isVisible = !state.initialLoading && state.error == null && recentList.isEmpty()
        cloudMusicRecentSongsContainer.isVisible = recentList.isNotEmpty()

        if (recentList.isNotEmpty()) {
            bindRecentSongsContainer(recentList)
        } else {
            cloudMusicRecentSongsContainer.removeAllViews()
        }
    }

    private fun bindRecentSongsContainer(songs: List<SongInfo>) = with(binding.cloudMusicRecentSongsContainer) {
        removeAllViews()
        val inflater = LayoutInflater.from(context)
        songs.forEach { song ->
            val itemBinding = ItemRecommendSongBinding.inflate(inflater, this, false)
            bindSongItem(itemBinding, song)
            addView(itemBinding.root)
        }
    }

    private fun bindSongItem(itemBinding: ItemRecommendSongBinding, song: SongInfo) = with(itemBinding) {
        val context = root.context
        val playable = song.playable
        songNameTextView.text = song.name
        singerTextView.text = song.artist
        SongSourceTagBinder.bind(songSourceTagTextView, song.type)
        coverImageView.load(SongCoverUrl.getSongCover(song, SongCoverUrl.SIZE_SMALL)) {
            placeholder(R.drawable.ic_pm_icon)
            error(R.drawable.ic_pm_icon)
        }

        val liked = loveManager.isSongInLoveList(song)
        btnLove.setImageResource(
            if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
        )
        btnLove.imageTintList = ContextCompat.getColorStateList(
            context,
            if (liked) R.color.red else R.color.home_tab_unselected,
        )
        root.alpha = if (playable) 1f else DISABLED_ALPHA
        btnDownload.isEnabled = playable
        btnDownload.alpha = if (playable) 1f else 0.4f

        root.setOnClickListener { playSong(song) }
        btnLove.setOnClickListener {
            loveManager.toggleLikeStatus(song)
            val newLiked = loveManager.isSongInLoveList(song)
            btnLove.setImageResource(
                if (newLiked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
            )
            btnLove.imageTintList = ContextCompat.getColorStateList(
                context,
                if (newLiked) R.color.red else R.color.home_tab_unselected,
            )
        }
        btnDownload.setOnClickListener { downloadSong(song) }
        btnMore.setOnClickListener { showMoreMenu(song) }
    }

    private fun playSong(song: SongInfo) {
        if (!song.playable) {
            Toast.makeText(requireContext(), R.string.cloud_music_disabled_play, Toast.LENGTH_SHORT).show()
            return
        }
        musicController.addToPlayList(song, autoPlay = true)
    }

    private fun downloadSong(song: SongInfo) {
        if (!song.playable) {
            Toast.makeText(requireContext(), R.string.cloud_music_disabled_download, Toast.LENGTH_SHORT).show()
            return
        }
        val activity = activity as? MainActivity
        if (activity == null) {
            Toast.makeText(requireContext(), R.string.download_failed_retry, Toast.LENGTH_SHORT).show()
            return
        }
        activity.downloadSong(song)
    }

    private fun showMoreMenu(song: SongInfo) {
        SongMoreMenu.show(
            requireActivity(),
            song,
            SongMoreMenuDependencies(
                musicController = musicController,
                loveManager = loveManager,
                playlistCollectionManager = playlistCollectionManager,
                onDownloadClick = ::downloadSong,
                showPlayNext = song.playable,
                showDownload = song.playable,
                allowQueueTarget = song.playable,
            ),
        )
    }

    override fun onDestroyView() {
        _binding = null
        super.onDestroyView()
    }

    private companion object {
        const val MAX_RECENT_PREVIEW_COUNT = 3
        const val DISABLED_ALPHA = 0.56f
    }
}
