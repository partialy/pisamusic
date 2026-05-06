package cn.partialy.pm.ui.mine

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.databinding.FragmentMinePlaylistsTabBinding
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MinePlaylistsTabFragment : Fragment() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private var _binding: FragmentMinePlaylistsTabBinding? = null
    private val binding get() = _binding!!

    private val adapter = MinePlaylistsAdapter(
        onMoreClick = { playlist ->
            MinePlaylistMoreBottomSheet.show(this, playlist, playlistCollectionManager)
        },
    )

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentMinePlaylistsTabBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val rv = binding.playlistsRecyclerView
        rv.layoutManager = LinearLayoutManager(requireContext())
        rv.adapter = adapter
        rv.itemAnimator = null

        viewLifecycleOwner.lifecycleScope.launch {
            playlistCollectionManager.playlistsFlow.collectLatest { list ->
                val nonLocalList = list.filter { it.type != CollectedPlaylistType.LOCAL }
                binding.emptyTextView.isVisible = nonLocalList.isEmpty()
                adapter.submitList(nonLocalList) {
                    binding.playlistsRecyclerView.post {
                        (parentFragment as? MineFragment)?.requestMineViewPagerHeightUpdate()
                    }
                }
            }
        }
    }
}
