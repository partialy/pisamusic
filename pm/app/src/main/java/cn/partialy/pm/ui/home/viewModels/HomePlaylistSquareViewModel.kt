package cn.partialy.pm.ui.home.viewModels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.network.repository.KgRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomePlaylistSquareViewModel @Inject constructor(
    private val kgRepository: KgRepository,
) : ViewModel() {

    private val _playlists = MutableStateFlow<List<HomeRecommendPlaylist>>(emptyList())
    val playlists: StateFlow<List<HomeRecommendPlaylist>> = _playlists

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _isLoadingMore = MutableStateFlow(false)
    val isLoadingMore: StateFlow<Boolean> = _isLoadingMore

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing

    private var page = 1
    private var loadingMore = false
    private var hasMore = true

    fun loadInitial() {
        page = 1
        hasMore = true
        _playlists.value = emptyList()
        loadNextPage(reset = true, refreshing = false)
    }

    fun refresh() {
        page = 1
        hasMore = true
        _playlists.value = emptyList()
        loadNextPage(reset = true, refreshing = true)
    }

    fun loadMoreIfNeeded() {
        if (loadingMore || !hasMore) return
        loadNextPage(reset = false, refreshing = false)
    }

    private fun loadNextPage(reset: Boolean, refreshing: Boolean) {
        loadingMore = true
        if (refreshing) {
            _isRefreshing.value = true
        } else if (reset) {
            _isLoading.value = true
        } else {
            _isLoadingMore.value = true
        }
        val currentPage = page
        viewModelScope.launch {
            try {
                val res = kgRepository.getRecommendPlaylists(page = currentPage, pagesize = PAGE_SIZE)
                res.onSuccess { chunk ->
                    val old = if (reset) emptyList() else _playlists.value
                    val merged = (old + chunk).distinctBy { it.id }
                    _playlists.value = merged
                    val addedCount = merged.size - old.size
                    hasMore = chunk.isNotEmpty() && addedCount > 0 && chunk.size >= PAGE_SIZE
                    page = currentPage + 1
                }
                res.onFailure {
                    hasMore = false
                }
            } finally {
                loadingMore = false
                _isLoading.value = false
                _isLoadingMore.value = false
                _isRefreshing.value = false
            }
        }
    }

    companion object {
        private const val PAGE_SIZE = 30
    }
}
