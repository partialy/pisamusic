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
class HomePlaylistListViewModel @Inject constructor(
    private val kgRepository: KgRepository,
) : ViewModel() {

    private val _playlists = MutableStateFlow<List<HomeRecommendPlaylist>>(emptyList())
    val playlists: StateFlow<List<HomeRecommendPlaylist>> = _playlists

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing

    private val _isLoadingMore = MutableStateFlow(false)
    val isLoadingMore: StateFlow<Boolean> = _isLoadingMore

    private val _loadFailed = MutableStateFlow(false)
    val loadFailed: StateFlow<Boolean> = _loadFailed

    private var categoryId: Int = 0
    private var inited = false
    private var page = 1
    private var hasMore = true
    private var loadingMore = false

    fun init(categoryId: Int) {
        if (inited && this.categoryId == categoryId) return
        this.categoryId = categoryId
        inited = true
        page = 1
        hasMore = true
        _loadFailed.value = false
        _playlists.value = emptyList()
        loadPage(pageNum = 1, append = false, refreshing = false)
    }

    fun refresh() {
        if (!inited) return
        page = 1
        hasMore = true
        _loadFailed.value = false
        _playlists.value = emptyList()
        loadPage(pageNum = 1, append = false, refreshing = true)
    }

    fun loadMore() {
        if (!inited || loadingMore || !hasMore) return
        loadPage(pageNum = page, append = true, refreshing = false)
    }

    private fun loadPage(pageNum: Int, append: Boolean, refreshing: Boolean) {
        loadingMore = true
        when {
            refreshing -> _isRefreshing.value = true
            append -> _isLoadingMore.value = true
            else -> _isLoading.value = true
        }
        viewModelScope.launch {
            try {
                val pageResult = kgRepository.getRecommendPlaylistsPage(
                    categoryId = categoryId,
                    page = pageNum,
                )
                val pageData = pageResult.getOrNull()
                if (pageData == null) {
                    _loadFailed.value = true
                    if (!append) {
                        _playlists.value = emptyList()
                        hasMore = false
                    }
                    return@launch
                }
                _loadFailed.value = false
                val chunk = pageData.list
                val old = if (append) _playlists.value else emptyList()
                val merged = (old + chunk).distinctBy { it.id }
                _playlists.value = merged
                hasMore = pageData.hasNext
                page = pageNum + 1
            } finally {
                loadingMore = false
                _isLoading.value = false
                _isRefreshing.value = false
                _isLoadingMore.value = false
            }
        }
    }
}
