package cn.partialy.pm.ui.home.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Toast
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.FeedbackWebActivity
import cn.partialy.pm.activity.MainActivity
import cn.partialy.pm.activity.PlaylistDetailActivity
import cn.partialy.pm.activity.home.HomePlaylistExploreActivity
import cn.partialy.pm.databinding.FragmentRecommendedSongsBinding
import cn.partialy.pm.model.RecommendSongInfo
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.base.BaseSongFragment
import cn.partialy.pm.ui.home.adapters.HomeDailySongGridAdapter
import cn.partialy.pm.ui.home.adapters.HomeFeatureCardItem
import cn.partialy.pm.ui.home.adapters.HomeFeatureCardKind
import cn.partialy.pm.ui.home.adapters.HomeFeatureCardsAdapter
import cn.partialy.pm.ui.home.adapters.HomeRecommendPlaylistAdapter
import cn.partialy.pm.ui.home.requestDisallowViewPager2InterceptOnHorizontalDrag
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.home.viewModels.RecommendedSongsViewModel
import cn.partialy.pm.ui.home.viewModels.TopCardSectionState
import cn.partialy.pm.ui.web.LocalGenericErrorWebViewController
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import javax.inject.Inject

private data class RecommendUiState(
    val loading: Boolean,
    val failed: Boolean,
    val songs: List<RecommendSongInfo>,
    val playlists: Int,
)

@AndroidEntryPoint
class RecommendedSongsFragment : BaseSongFragment() {

    @Inject
    lateinit var controller: MusicController

    @Inject
    lateinit var love: LoveManager

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private var _binding: FragmentRecommendedSongsBinding? = null
    private val binding get() = _binding!!

    private lateinit var featureCardsAdapter: HomeFeatureCardsAdapter
    private lateinit var playlistAdapter: HomeRecommendPlaylistAdapter
    private lateinit var dailySongAdapter: HomeDailySongGridAdapter
    private val topCardAdapters = mutableMapOf<Int, HomeDailySongGridAdapter>()

    private val viewModel: RecommendedSongsViewModel by viewModels()

    private var errorWebController: LocalGenericErrorWebViewController? = null
    private var pullRefreshing = false
    private var topCardsRequested = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        musicController = controller
        loveManager = love
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentRecommendedSongsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.recommendSwipeRefreshLayout.setOnRefreshListener {
            pullRefreshing = true
            topCardsRequested = false
            viewModel.refresh()
        }
        errorWebController = LocalGenericErrorWebViewController(
            binding.recommendErrorWebView,
            onRetry = { viewModel.refresh() },
            onFeedback = {
                FeedbackWebActivity.start(requireContext())
            },
        ).also { it.attach() }
        super.onViewCreated(view, savedInstanceState)
    }

    override fun setupRecyclerView() {
        featureCardsAdapter = HomeFeatureCardsAdapter { kind ->
            when (kind) {
                HomeFeatureCardKind.GUESS_YOU_LIKE -> {
                    val act = activity
                    if (act is MainActivity) act.openHomeFavoriteTab()
                }
                HomeFeatureCardKind.DAILY_RECOMMEND -> {
                    binding.recommendScrollView.post {
                        binding.recommendScrollView.smoothScrollTo(0, binding.dailySongsSectionHeader.top)
                    }
                }
                HomeFeatureCardKind.RADAR_PLAYLIST -> {
                    HomePlaylistExploreActivity.start(requireActivity())
                }
            }
        }
        playlistAdapter = HomeRecommendPlaylistAdapter { item ->
            PlaylistDetailActivity.start(
                requireActivity(),
                playlistId = item.id,
                title = item.name,
                coverUrl = item.coverUrl,
                playCountLabel = item.playCountLabel,
            )
        }
        dailySongAdapter = createDailySongAdapter()
        adapter = dailySongAdapter

        binding.homeFeatureCardsRecyclerView.apply {
            layoutManager = LinearLayoutManager(context, RecyclerView.HORIZONTAL, false)
            adapter = featureCardsAdapter
            requestDisallowViewPager2InterceptOnHorizontalDrag()
        }
        binding.homePlaylistRecyclerView.apply {
            layoutManager = GridLayoutManager(context, 2, RecyclerView.HORIZONTAL, false)
            adapter = playlistAdapter
        }
        binding.homeDailySongsRecyclerView.apply {
            layoutManager = GridLayoutManager(context, 6, RecyclerView.HORIZONTAL, false)
            adapter = dailySongAdapter
        }
        playlistAdapter.showSkeleton()
        dailySongAdapter.showSkeleton()
        bindTopCardRecyclerView(3, binding.homeTopCardRecyclerView3)
        bindTopCardRecyclerView(4, binding.homeTopCardRecyclerView4)
        bindTopCardRecyclerView(5, binding.homeTopCardRecyclerView5)
        bindTopCardRecyclerView(6, binding.homeTopCardRecyclerView6)

        featureCardsAdapter.submitList(
            listOf(
                HomeFeatureCardItem(HomeFeatureCardKind.GUESS_YOU_LIKE),
                HomeFeatureCardItem(HomeFeatureCardKind.DAILY_RECOMMEND),
                HomeFeatureCardItem(HomeFeatureCardKind.RADAR_PLAYLIST),
            ),
        )

        binding.btnMorePlaylists.setOnClickListener {
            HomePlaylistExploreActivity.start(requireActivity())
        }
        binding.btnPlayAllDaily.setOnClickListener { playAllDaily() }
    }

    override fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            combine(
                viewModel.isLoading,
                viewModel.recommendLoadFailed,
                viewModel.dailyRecommendSongs,
                viewModel.recommendPlaylists,
            ) { loading, failed, songs, playlists ->
                RecommendUiState(
                    loading = loading,
                    failed = failed,
                    songs = songs,
                    playlists = playlists.size,
                )
            }.collectLatest { state ->
                binding.progressBar.visibility = View.GONE
                binding.recommendSwipeRefreshLayout.isRefreshing = state.loading && pullRefreshing
                val fatalError = !state.loading && state.failed && state.songs.isEmpty()
                binding.recommendErrorWebView.visibility = if (fatalError) View.VISIBLE else View.GONE
                binding.recommendScrollView.visibility = if (fatalError) View.INVISIBLE else View.VISIBLE
                renderMainSectionsSkeleton(state.loading, state.songs.isEmpty(), state.playlists == 0)
                if (state.loading || fatalError) {
                    errorWebController?.resetRetryUi()
                }
                if (!state.loading) {
                    pullRefreshing = false
                    binding.recommendSwipeRefreshLayout.isRefreshing = false
                    if (!topCardsRequested && !fatalError) {
                        topCardsRequested = true
                        viewModel.loadTopCardsSequentially()
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.dailyRecommendSongs.collectLatest { songs ->
                if (songs.isNotEmpty()) {
                    dailySongAdapter.hideSkeleton()
                }
                dailySongAdapter.submitList(songs)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.recommendPlaylists.collectLatest { list ->
                if (list.isNotEmpty()) {
                    playlistAdapter.hideSkeleton()
                }
                playlistAdapter.submitList(list)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.topCardSections.collectLatest { sections ->
                sections.forEach { renderTopCardSection(it) }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            loveManager.loveListFlow.collectLatest {
                if (::dailySongAdapter.isInitialized) {
                    dailySongAdapter.refreshLoveStates()
                }
                topCardAdapters.values.forEach { it.refreshLoveStates() }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::dailySongAdapter.isInitialized) {
            dailySongAdapter.refreshLoveStates()
        }
        topCardAdapters.values.forEach { it.refreshLoveStates() }
    }

    override fun onDestroyView() {
        errorWebController?.detach()
        errorWebController = null
        val wv = binding.recommendErrorWebView
        (wv.parent as? ViewGroup)?.removeView(wv)
        wv.stopLoading()
        wv.loadUrl("about:blank")
        wv.removeAllViews()
        wv.destroy()
        topCardAdapters.clear()
        topCardsRequested = false
        super.onDestroyView()
        _binding = null
    }

    private fun downloadRecommendSong(rec: RecommendSongInfo) {
        val song = rec.convertToSongInfo()
        if (song.album == null) {
            song.album = song.name
        }
        val act = activity
        if (act is MainActivity) {
            act.downloadSong(song)
        } else {
            Toast.makeText(requireContext(), "下载失败，请稍后重试", Toast.LENGTH_SHORT).show()
        }
    }

    private fun playAllDaily() {
        val songs = viewModel.dailyRecommendSongs.value.map { it.convertToSongInfo() }
        if (songs.isEmpty()) {
            Toast.makeText(requireContext(), R.string.playlist_empty_hint, Toast.LENGTH_SHORT).show()
            return
        }
        musicController.setPlayListLazy(songs)
    }

    private fun createDailySongAdapter(): HomeDailySongGridAdapter {
        return HomeDailySongGridAdapter(
            isLiked = { song -> loveManager.isSongInLoveList(song) },
            onItemClick = { rec, _ ->
                musicController.addToPlayList(rec.convertToSongInfo(), autoPlay = true)
            },
            onDownloadClick = { rec, _ -> downloadRecommendSong(rec) },
            onLoveClick = { rec, _ ->
                val song = rec.convertToSongInfo()
                loveManager.toggleLikeStatus(song)
            },
            onMoreClick = { rec, _ ->
                SongMoreMenu.show(
                    requireActivity(),
                    rec.convertToSongInfo(),
                    SongMoreMenuDependencies(
                        musicController = musicController,
                        loveManager = loveManager,
                        playlistCollectionManager = playlistCollectionManager,
                        onDownloadClick = { downloadRecommendSong(rec) },
                    ),
                )
            },
        )
    }

    private fun bindTopCardRecyclerView(cardId: Int, recyclerView: RecyclerView) {
        val adapter = createDailySongAdapter()
        topCardAdapters[cardId] = adapter
        recyclerView.layoutManager = GridLayoutManager(requireContext(), 6, RecyclerView.HORIZONTAL, false)
        recyclerView.adapter = adapter
    }

    private fun renderTopCardSection(state: TopCardSectionState) {
        val section = when (state.cardId) {
            3 -> binding.topCardSection3
            4 -> binding.topCardSection4
            5 -> binding.topCardSection5
            6 -> binding.topCardSection6
            else -> return
        }
        val title = when (state.cardId) {
            3 -> binding.topCardTitle3
            4 -> binding.topCardTitle4
            5 -> binding.topCardTitle5
            6 -> binding.topCardTitle6
            else -> return
        }
        topCardAdapters[state.cardId]?.submitList(state.songs)
        when {
            state.isLoading && state.songs.isEmpty() -> {
                title.text = "加载中..."
                topCardAdapters[state.cardId]?.showSkeleton()
                section.visibility = View.VISIBLE
            }
            state.songs.isNotEmpty() && state.title.isNotBlank() -> {
                title.text = state.title
                topCardAdapters[state.cardId]?.hideSkeleton()
                section.visibility = View.VISIBLE
            }
            else -> {
                topCardAdapters[state.cardId]?.hideSkeleton()
                section.visibility = View.GONE
            }
        }
    }

    private fun renderMainSectionsSkeleton(
        loading: Boolean,
        songsEmpty: Boolean,
        playlistsEmpty: Boolean,
    ) {
        if (loading && songsEmpty) {
            dailySongAdapter.showSkeleton()
        } else {
            dailySongAdapter.hideSkeleton()
        }
        if (loading && playlistsEmpty) {
            playlistAdapter.showSkeleton()
        } else {
            playlistAdapter.hideSkeleton()
        }
    }
}
