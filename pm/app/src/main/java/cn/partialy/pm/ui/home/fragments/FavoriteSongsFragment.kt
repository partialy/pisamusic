package cn.partialy.pm.ui.home.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.activity.MainActivity
import cn.partialy.pm.databinding.FragmentFavoriteSongsBinding
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.base.BaseSongFragment
import cn.partialy.pm.ui.home.adapters.FavoriteSongsAdapter
import cn.partialy.pm.ui.home.viewModels.FavoriteSongsViewModel
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject


@AndroidEntryPoint
class FavoriteSongsFragment : BaseSongFragment() {
    @Inject
    lateinit var controller: MusicController

    @Inject
    lateinit var love: LoveManager

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    // 视图绑定实例
    private var _binding: FragmentFavoriteSongsBinding? = null
    private val binding get() = _binding!!

    // 适配器实例
    private lateinit var favoriteAdapter: FavoriteSongsAdapter

    // ViewModel 实例
    private lateinit var viewModel: FavoriteSongsViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        musicController = controller
        loveManager = love
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        // 初始化 ViewModel
        viewModel = ViewModelProvider(requireActivity())[FavoriteSongsViewModel::class.java]
        // 初始化数据绑定
        viewModel.loadSongs()
        _binding = FragmentFavoriteSongsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun setupRecyclerView() {
        // 初始化适配器并设置点击回调
        favoriteAdapter = FavoriteSongsAdapter(
            onSongClick = { songInfo, _ ->
                musicController.addToPlayList(songInfo, autoPlay = true)
            },
            onDownloadBtnClick = { songInfo, _ ->
                activity?.let { activity ->
                    if (activity is MainActivity) {
                        activity.downloadSong(songInfo)
                    }
                } ?: run {
                    context?.let { context ->
                        Toast.makeText(context, "下载失败，请稍后重试", Toast.LENGTH_SHORT).show()
                    }
                }
            },
            onMoreBtnClick = { songInfo, _ ->
                SongMoreMenu.show(
                    requireActivity(),
                    songInfo,
                    SongMoreMenuDependencies(
                        musicController = musicController,
                        loveManager = loveManager,
                        playlistCollectionManager = playlistCollectionManager,
                        onDownloadClick = { s ->
                            val act = activity
                            if (act is MainActivity) act.downloadSong(s)
                            else Toast.makeText(requireContext(), "下载失败，请稍后重试", Toast.LENGTH_SHORT).show()
                        },
                    ),
                )
            }
        )

        // 配置 RecyclerView
        binding.favoriteRecyclerView.apply {
            layoutManager = LinearLayoutManager(context)  // 设置线性布局
            adapter = favoriteAdapter  // 设置适配器
        }
    }

    override fun observeViewModel() {
        // 观察收藏歌曲数据变化
        viewModel.songs.observe(viewLifecycleOwner) { songs ->
            if (songs.isEmpty()) {
                showEmptyText()
            } else {
                binding.emptyTextView.visibility = View.GONE
                binding.favoriteRecyclerView.visibility = View.VISIBLE
                favoriteAdapter.updateSongs(songs)
            }
        }

        // 观察加载状态变化
        viewModel.isLoading.observe(viewLifecycleOwner){ isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        }
    }

    private fun showEmptyText(){
        binding.emptyTextView.visibility = View.VISIBLE
        binding.favoriteRecyclerView.visibility = View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
