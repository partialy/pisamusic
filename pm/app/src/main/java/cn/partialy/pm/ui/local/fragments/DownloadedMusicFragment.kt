package cn.partialy.pm.ui.local.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.FragmentDownloadedMusicBinding
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.base.BaseSongFragment
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.local.adapters.DownloadedMusicAdapter
import cn.partialy.pm.ui.local.viewModels.DownloadedMusicState
import cn.partialy.pm.ui.local.viewModels.DownloadedMusicViewModel
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject


@AndroidEntryPoint
class DownloadedMusicFragment : BaseSongFragment() {
    @Inject
    lateinit var controller: MusicController

    @Inject
    lateinit var love: LoveManager

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager
    // 视图绑定实例
    private var _binding: FragmentDownloadedMusicBinding? = null
    private val binding get() = _binding!!

    // 适配器实例
    private lateinit var downloadedMusicAdapter: DownloadedMusicAdapter

    // ViewModel 实例
    private lateinit var viewModel: DownloadedMusicViewModel

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
        // 初始化viewModel
        viewModel = ViewModelProvider(requireActivity())[DownloadedMusicViewModel::class.java]
        // 初始化数据绑定
        _binding = FragmentDownloadedMusicBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun setupRecyclerView() {
        downloadedMusicAdapter = DownloadedMusicAdapter(
            onSongClick = { songInfo, _ ->
                musicController.addToPlayList(songInfo, true)
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
                            if (act is BaseDownloadActivity) act.startSongDownloadFlow(s)
                            else Toast.makeText(requireContext(), R.string.local_song_no_online_download, Toast.LENGTH_SHORT).show()
                        },
                    ),
                )
            }
        )

        binding.downloadedSongRecyclerView.apply {
            adapter = downloadedMusicAdapter
            layoutManager = LinearLayoutManager(context)
        }

        // 直接在这里观察数据变化
        observeViewModel()
    }

    // 修改观察ViewModel方法
    override fun observeViewModel() {
        viewModel.state.observe(viewLifecycleOwner) { state ->
            when (state) {
                is DownloadedMusicState.Loading -> {
                    binding.progressBar.visibility = View.VISIBLE
                    binding.downloadedSongRecyclerView.visibility = View.GONE
                    binding.emptyTextView.visibility = View.GONE
                }

                is DownloadedMusicState.Success -> {
                    binding.progressBar.visibility = View.GONE
                    if (state.songs.isEmpty()) {
                        showEmptyState("暂无下载歌曲")
                    } else {
                        binding.downloadedSongRecyclerView.visibility = View.VISIBLE
                        binding.emptyTextView.visibility = View.GONE
                        downloadedMusicAdapter.submitList(state.songs)
                    }
                }

                is DownloadedMusicState.Error -> {
                    binding.progressBar.visibility = View.GONE
                    showEmptyState(state.message)
                }
            }
        }
    }

    // 修改显示空状态方法
    private fun showEmptyState(message: String) {
        binding.apply {
            downloadedSongRecyclerView.visibility = View.GONE
            emptyTextView.visibility = View.VISIBLE
            emptyTextView.findViewById<TextView>(R.id.emptyText).text = message
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}