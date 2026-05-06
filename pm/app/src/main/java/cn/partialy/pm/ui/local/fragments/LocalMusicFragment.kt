package cn.partialy.pm.ui.local.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.databinding.FragmentLocalMusicBinding
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.base.BaseSongFragment
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.local.adapters.LocalMusicAdapter
import cn.partialy.pm.ui.local.viewModels.LocalMusicViewModel
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class LocalMusicFragment : BaseSongFragment() {
    @Inject
    lateinit var controller: MusicController

    @Inject
    lateinit var love: LoveManager

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    // 视图绑定实例
    private var _binding: FragmentLocalMusicBinding? = null
    private val binding get() = _binding!!

    // 适配器实例
    private lateinit var localMusicAdapter: LocalMusicAdapter

    // ViewModel 实例
    private lateinit var viewModel: LocalMusicViewModel

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
        _binding = FragmentLocalMusicBinding.inflate(inflater, container, false)
        // 使用 activity 范围的 ViewModel
        viewModel = ViewModelProvider(requireActivity())[LocalMusicViewModel::class.java]
        return binding.root
    }

    override fun setupRecyclerView() {
        localMusicAdapter = LocalMusicAdapter(
            onSongClick = { songInfo, _ ->
                musicController.addToPlayList(songInfo, true)
            },
            onDownloadBtnClick = { _, _ -> },
            onMoreBtnClick = { songInfo, _ ->
                SongMoreMenu.show(
                    requireActivity(),
                    songInfo,
                    SongMoreMenuDependencies(
                        musicController = musicController,
                        loveManager = loveManager,
                        playlistCollectionManager = playlistCollectionManager,
                        onDownloadClick = {
                            Toast.makeText(requireContext(), R.string.local_song_no_online_download, Toast.LENGTH_SHORT).show()
                        },
                    ),
                )
            }
        )

        binding.localSongRecyclerView.apply {
            adapter = localMusicAdapter
            layoutManager = LinearLayoutManager(context)
        }

        // 直接在这里观察数据变化
        observeViewModel()
    }

    override fun observeViewModel() {
        viewModel.songInfos.observe(viewLifecycleOwner) { songInfos ->
            if (songInfos.isEmpty()) {
                showEmptyState()
            } else {
                binding.localSongRecyclerView.visibility = View.VISIBLE
                binding.emptyTextView.visibility = View.GONE
                localMusicAdapter.submitList(songInfos)
            }
        }
    }

    // 显示空状态
    fun showEmptyState() {
        binding.localSongRecyclerView.visibility = View.GONE
        binding.emptyTextView.visibility = View.VISIBLE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

}