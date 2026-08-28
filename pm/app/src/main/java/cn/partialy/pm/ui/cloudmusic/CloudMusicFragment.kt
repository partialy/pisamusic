package cn.partialy.pm.ui.cloudmusic

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.CloudMusicSubmissionActivity
import cn.partialy.pm.activity.MainActivity
import cn.partialy.pm.databinding.FragmentCloudMusicBinding
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.collect

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
    private lateinit var listAdapter: CloudMusicListAdapter

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
        setupList()
        binding.cloudMusicSwipeRefresh.setOnRefreshListener(viewModel::refresh)
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.state.collect { state ->
                    binding.cloudMusicSwipeRefresh.isRefreshing = state.refreshing
                    listAdapter.submitState(state)
                }
            }
        }
    }

    private fun setupList() {
        listAdapter = CloudMusicListAdapter(
            onSubmitClick = { CloudMusicSubmissionActivity.start(requireContext()) },
            onKeywordChanged = viewModel::setKeyword,
            onSearchNow = viewModel::searchNow,
            onSongClick = ::playSong,
            onDownloadClick = ::downloadSong,
            onMoreClick = ::showMoreMenu,
            onRetryFirstPage = viewModel::retryFirstPage,
            onRetryLoadMore = viewModel::loadMore,
        )
        binding.cloudMusicRecyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = listAdapter
            itemAnimator = null
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    if (dy <= 0) return
                    val lastVisible = (layoutManager as? LinearLayoutManager)
                        ?.findLastVisibleItemPosition()
                        ?: return
                    if (lastVisible >= listAdapter.itemCount - LOAD_MORE_THRESHOLD) {
                        viewModel.loadMore()
                    }
                }
            })
        }
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
        binding.cloudMusicRecyclerView.adapter = null
        _binding = null
        super.onDestroyView()
    }

    private companion object {
        const val LOAD_MORE_THRESHOLD = 5
    }
}
