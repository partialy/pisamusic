package cn.partialy.pm.ui.mine

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.ConcatAdapter
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.FavoritePlaylistsActivity
import cn.partialy.pm.activity.DownloadManagementActivity
import cn.partialy.pm.activity.LocalMusicActivity
import cn.partialy.pm.activity.LocalPlaylistManagementActivity
import cn.partialy.pm.activity.LovedSongsPlaylistActivity
import cn.partialy.pm.activity.SettingsActivity
import cn.partialy.pm.databinding.FragmentMineMyTabBinding
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.toCanonicalPlaylist
import cn.partialy.pm.ui.dialog.PlaylistActionBottomSheet
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MineMyTabFragment : Fragment() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private var _binding: FragmentMineMyTabBinding? = null
    private val binding get() = _binding!!
    private val localPlaylistsAdapter = MinePlaylistsAdapter(
        onMoreClick = { playlist ->
            // 与本地歌单详情页右上角“更多”使用完全相同的菜单及删除确认。
            PlaylistActionBottomSheet.show(
                activity = requireActivity(),
                playlist = playlist.toCanonicalPlaylist(),
                deleteTarget = playlist,
                manager = playlistCollectionManager,
            )
        },
    )

    private val overviewAdapter = MineMyOverviewAdapter(
        onFavoriteSongsClick = { LovedSongsPlaylistActivity.start(requireActivity()) },
        onFavoritePlaylistsClick = { FavoritePlaylistsActivity.start(requireActivity()) },
        onLocalMusicClick = { LocalMusicActivity.start(requireActivity()) },
        onDownloadManagementClick = { DownloadManagementActivity.start(requireActivity()) },
        onSettingsClick = { SettingsActivity.start(requireActivity()) },
        onManageLocalPlaylistsClick = { LocalPlaylistManagementActivity.start(requireActivity()) },
        onAddLocalPlaylistClick = ::showCreateLocalPlaylistDialog,
    )

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentMineMyTabBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.mineMyRecyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = ConcatAdapter(overviewAdapter, localPlaylistsAdapter)
            itemAnimator = null
            isNestedScrollingEnabled = true
        }

        viewLifecycleOwner.lifecycleScope.launch {
            playlistCollectionManager.playlistsFlow.collectLatest { list ->
                val localOnly = list.filter { it.type == CollectedPlaylistType.LOCAL }
                overviewAdapter.setLocalPlaylistEmpty(localOnly.isEmpty())
                localPlaylistsAdapter.submitAuthoritativeList(localOnly)
            }
        }

    }

    private fun showCreateLocalPlaylistDialog() {
        cn.partialy.pm.ui.dialog.LocalPlaylistCreateDialog.show(requireActivity(), playlistCollectionManager)
    }
}
