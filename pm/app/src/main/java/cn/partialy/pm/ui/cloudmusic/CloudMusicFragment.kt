package cn.partialy.pm.ui.cloudmusic

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
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
    private lateinit var listAdapter: CloudMusicListAdapter
    private var isSettingSearchText = false

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
        setupFixedHeader()
        setupList()
        observeState()
    }

    private fun setupFixedHeader() = with(binding) {
        cloudMusicSubmitButton.setOnClickListener {
            CloudMusicSubmissionActivity.start(requireContext())
        }

        cloudMusicClearSearchButton.setOnClickListener {
            cloudMusicSearchInput.setText("")
            cloudMusicClearSearchButton.isVisible = false
            viewModel.setKeyword("")
        }

        cloudMusicSearchInput.doAfterTextChanged { editable ->
            if (isSettingSearchText) return@doAfterTextChanged
            val text = editable?.toString().orEmpty()
            cloudMusicClearSearchButton.isVisible = text.isNotEmpty()
            viewModel.setKeyword(text)
        }

        cloudMusicSearchInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                hideKeyboard(cloudMusicSearchInput)
                viewModel.searchNow()
                true
            } else {
                false
            }
        }
    }

    private fun setupList() {
        listAdapter = CloudMusicListAdapter(
            isSongLiked = { loveManager.isSongInLoveList(it) },
            onLoveClick = { song ->
                loveManager.toggleLikeStatus(song)
                listAdapter.notifySongChanged(song)
            },
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

        binding.cloudMusicSwipeRefresh.setOnRefreshListener(viewModel::refresh)
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.state.collectLatest { state ->
                        binding.cloudMusicSwipeRefresh.isRefreshing = state.refreshing

                        val dateStr = state.latestUpdatedAt?.let {
                            val pattern = getString(R.string.cloud_music_date_pattern)
                            SimpleDateFormat(pattern, Locale.getDefault()).format(Date(it))
                        }
                        binding.cloudMusicSummaryText.text = if (dateStr != null) {
                            getString(R.string.cloud_music_summary_inline, state.total, dateStr)
                        } else {
                            getString(R.string.cloud_music_summary_inline_no_update, state.total)
                        }

                        if (!binding.cloudMusicSearchInput.hasFocus() &&
                            binding.cloudMusicSearchInput.text?.toString() != state.keyword
                        ) {
                            isSettingSearchText = true
                            binding.cloudMusicSearchInput.setText(state.keyword)
                            binding.cloudMusicSearchInput.setSelection(state.keyword.length)
                            binding.cloudMusicClearSearchButton.isVisible = state.keyword.isNotEmpty()
                            isSettingSearchText = false
                        }

                        listAdapter.submitState(state)
                    }
                }

                launch {
                    loveManager.loveListFlow.collectLatest {
                        listAdapter.notifyDataSetChanged()
                    }
                }
            }
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

    private fun hideKeyboard(view: View) {
        val imm = view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(view.windowToken, 0)
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
