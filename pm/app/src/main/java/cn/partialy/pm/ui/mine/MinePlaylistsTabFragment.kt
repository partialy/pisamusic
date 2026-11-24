package cn.partialy.pm.ui.mine

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.activity.PlaylistManagementActivity
import cn.partialy.pm.activity.ThirdPartyPlaylistImportActivity
import cn.partialy.pm.R
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.toCanonicalSource
import cn.partialy.pm.ui.playlistdetail.BatchLongPressGuard
import cn.partialy.pm.databinding.FragmentMinePlaylistsTabBinding
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.toCanonicalPlaylist
import cn.partialy.pm.ui.dialog.PlaylistActionBottomSheet
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class MinePlaylistsTabFragment : Fragment() {

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private var _binding: FragmentMinePlaylistsTabBinding? = null
    private val binding get() = _binding!!
    private var query = ""
    private var sourcePlaylists: List<CollectedPlaylist> = emptyList()
    private var filterJob: Job? = null

    private val longPressGuard = BatchLongPressGuard()
    private val adapter = MinePlaylistsAdapter(
        onMoreClick = { playlist ->
            PlaylistActionBottomSheet.show(
                activity = requireActivity(),
                playlist = playlist.toCanonicalPlaylist(),
                deleteTarget = playlist,
                manager = playlistCollectionManager,
            )
        },
        onLongClick = { playlist ->
            if (longPressGuard.acquire()) {
                PlaylistManagementActivity.start(requireActivity(), playlist.type.toCanonicalSource(), playlist.id)
            }
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
        filterJob?.cancel()
        filterJob = null
        binding.playlistsRecyclerView.adapter = null
        super.onDestroyView()
        _binding = null
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_QUERY, query)
    }

    override fun onPause() {
        hideKeyboard()
        super.onPause()
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        savedInstanceState?.getString(STATE_QUERY)?.let { query = it }
        binding.searchInput.setText(query)
        binding.clearSearchButton.isVisible = query.isNotEmpty()
        binding.clearSearchButton.setOnClickListener { binding.searchInput.text?.clear() }
        binding.searchInput.doAfterTextChanged {
            query = it?.toString().orEmpty()
            binding.clearSearchButton.isVisible = query.isNotEmpty()
            scheduleFilter()
        }
        binding.searchInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId != EditorInfo.IME_ACTION_SEARCH) return@setOnEditorActionListener false
            hideKeyboard()
            true
        }
        binding.managePlaylistsButton.setOnClickListener { PlaylistManagementActivity.start(requireActivity()) }
        binding.importPlaylistsButton.setOnClickListener { ThirdPartyPlaylistImportActivity.start(requireActivity()) }
        binding.playlistsRecyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@MinePlaylistsTabFragment.adapter
            itemAnimator = null
            isNestedScrollingEnabled = true
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                playlistCollectionManager.playlistsFlow.collectLatest { list ->
                    sourcePlaylists = list.filter { it.type != CollectedPlaylistType.LOCAL }
                    scheduleFilter(immediate = true)
                }
            }
        }
        playlistCollectionManager.preloadIndexFromDiskAsync()
    }

    private fun scheduleFilter(immediate: Boolean = false) {
        filterJob?.cancel()
        val snapshot = sourcePlaylists
        val search = query.trim()
        filterJob = viewLifecycleOwner.lifecycleScope.launch {
            if (!immediate) delay(150)
            val filtered = withContext(Dispatchers.Default) { filter(snapshot, search) }
            val current = _binding ?: return@launch
            adapter.submitAuthoritativeList(filtered)
            current.emptyTextView.isVisible = filtered.isEmpty()
            current.emptyTextView.setText(if (search.isEmpty()) R.string.mine_playlists_empty else R.string.third_party_import_empty_search)
        }
    }

    private fun hideKeyboard() {
        val input = _binding?.searchInput ?: return
        if (!input.hasFocus()) return
        input.clearFocus()
        context?.getSystemService(InputMethodManager::class.java)?.hideSoftInputFromWindow(input.windowToken, 0)
    }

    companion object {
        private const val STATE_QUERY = "mine_playlist_query"
    }
}
