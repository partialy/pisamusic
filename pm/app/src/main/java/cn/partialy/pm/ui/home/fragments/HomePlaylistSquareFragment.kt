package cn.partialy.pm.ui.home.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.activity.PlaylistDetailActivity
import cn.partialy.pm.databinding.FragmentHomePlaylistSquareBinding
import cn.partialy.pm.ui.home.adapters.HomePlaylistGridAdapter
import cn.partialy.pm.ui.home.viewModels.HomePlaylistSquareViewModel
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@AndroidEntryPoint
class HomePlaylistSquareFragment : Fragment() {

    private var _binding: FragmentHomePlaylistSquareBinding? = null
    private val binding get() = _binding!!

    private val viewModel: HomePlaylistSquareViewModel by viewModels()
    private lateinit var adapter: HomePlaylistGridAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentHomePlaylistSquareBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        setupRefresh()
        observeViewModel()
        if (savedInstanceState == null) {
            viewModel.loadInitial()
        }
    }

    private fun setupRefresh() {
        binding.swipeRefreshLayout.setOnRefreshListener {
            viewModel.refresh()
        }
    }

    private fun setupRecyclerView() {
        adapter = HomePlaylistGridAdapter { item ->
            PlaylistDetailActivity.start(
                requireActivity(),
                playlistId = item.id,
                title = item.name,
                coverUrl = item.coverUrl,
                playCountLabel = item.playCountLabel,
            )
        }
        binding.playlistRecyclerView.apply {
            layoutManager = GridLayoutManager(context, 3)
            adapter = this@HomePlaylistSquareFragment.adapter
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (dy <= 0) return
                    val lm = recyclerView.layoutManager as? GridLayoutManager ?: return
                    val total = lm.itemCount
                    val lastVisible = lm.findLastVisibleItemPosition()
                    if (lastVisible >= total - 6) {
                        viewModel.loadMoreIfNeeded()
                    }
                }
            })
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.playlists.collectLatest { list ->
                adapter.submitList(list)
                binding.emptyTextView.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            }
        }
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isLoading.collectLatest { loading ->
                binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
            }
        }
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isLoadingMore.collectLatest { loading ->
                binding.loadMoreProgressBar.visibility = if (loading) View.VISIBLE else View.GONE
            }
        }
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.isRefreshing.collectLatest { refreshing ->
                binding.swipeRefreshLayout.isRefreshing = refreshing
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
