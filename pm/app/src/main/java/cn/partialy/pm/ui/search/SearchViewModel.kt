package cn.partialy.pm.ui.search

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.HotSearchInfo
import cn.partialy.pm.model.SearchPlaylistInfo
import cn.partialy.pm.model.SearchSongInfo
import cn.partialy.pm.model.SearchTrackRow
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.kw.KwRepository
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.search.*
import cn.partialy.pm.network.wy.WyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SearchViewModel @Inject constructor(
    application: Application,
    private val kgRepository: KgRepository,
    private val wyRepository: WyRepository,
    private val kwRepository: KwRepository,
) : AndroidViewModel(application) {

    private val _searchResults = MutableLiveData<List<SearchTrackRow>>()
    val searchResults: LiveData<List<SearchTrackRow>> = _searchResults

    private val _searchPlaylistResults = MutableLiveData<List<SearchPlaylistInfo>>()
    val searchPlaylistResults: LiveData<List<SearchPlaylistInfo>> = _searchPlaylistResults

    private val _suggestions = MutableLiveData<List<SearchSongInfo>>()
    val suggestions: LiveData<List<SearchSongInfo>> = _suggestions

    private val _hotSearchKeywords = MutableLiveData<List<HotSearchInfo>>()
    val hotSearchKeywords: LiveData<List<HotSearchInfo>> = _hotSearchKeywords

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _isLoadingMore = MutableLiveData(false)
    val isLoadingMore: LiveData<Boolean> = _isLoadingMore

    private val _searchFailed = MutableLiveData(false)
    val searchFailed: LiveData<Boolean> = _searchFailed

    private val _isPlaylistLoading = MutableLiveData(false)
    val isPlaylistLoading: LiveData<Boolean> = _isPlaylistLoading

    private val _isPlaylistLoadingMore = MutableLiveData(false)
    val isPlaylistLoadingMore: LiveData<Boolean> = _isPlaylistLoadingMore

    private val _playlistSearchFailed = MutableLiveData(false)
    val playlistSearchFailed: LiveData<Boolean> = _playlistSearchFailed

    private val _searchHistory = MutableLiveData<List<String>>()
    val searchHistory: LiveData<List<String>> = _searchHistory

    private val _searchSource = MutableLiveData(SongType.KG)
    val searchSource: LiveData<SongType> = _searchSource

    private val maxHistorySize = 20

    private var currentKeyword = ""
    private var moreLoading = false
    private var isLastPage = false

    private var kgPage = 1
    private var wyPage = 1
    private var kwPage = 1

    private var playlistPage = 1
    private var playlistTotal = 0
    private var playlistLastPage = false
    private var playlistKeyword = ""
    private var playlistMoreLoading = false

    fun currentSearchKeyword(): String = currentKeyword

    fun setSearchSource(type: SongType) {
        if (_searchSource.value == type) return
        _searchSource.value = type
        _suggestions.value = emptyList()
        if (currentKeyword.isNotEmpty()) {
            search(currentKeyword, isNewSearch = true, recordHistory = false)
        } else {
            _searchResults.value = emptyList()
        }
    }

    fun loadHotSearchKeywords() {
        viewModelScope.launch {
            try {
                val result = kgRepository.getHotSongs()
                result.onSuccess { response ->
                    _hotSearchKeywords.value = response.list
                }
                result.onFailure { e ->
                    println("获取hot失败：$e")
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun getSuggestions(keyword: String) {
        if (keyword.isEmpty()) {
            _suggestions.value = emptyList()
            return
        }
        if (_searchSource.value != SongType.KG) {
            _suggestions.value = emptyList()
            return
        }

        viewModelScope.launch {
            try {
                val result = kgRepository.getLinkKeyword(keyword)
                result.onSuccess { response ->
                    _suggestions.value = response.lists
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    /**
     * @param recordHistory 为 false 时用于切换音源后的自动刷新，避免重复写入历史
     */
    fun search(keyword: String, isNewSearch: Boolean = true, recordHistory: Boolean = true) {
        // 加载更多时避免重入；新关键词搜索必须允许打断上一次请求
        if (!isNewSearch && moreLoading) return

        if (isNewSearch) {
            kgPage = 1
            wyPage = 1
            kwPage = 1
            isLastPage = false
            currentKeyword = keyword
            _searchFailed.value = false
            _searchResults.value = emptyList()
            resetPlaylistSearchState()
            if (recordHistory) {
                addKeywordToHistory(keyword)
            }
        }

        if (isLastPage) return

        _isLoading.value = isNewSearch
        _isLoadingMore.value = !isNewSearch
        moreLoading = true

        viewModelScope.launch {
            try {
                val success = when (_searchSource.value ?: SongType.KG) {
                    SongType.KG -> searchKg(keyword, isNewSearch)
                    SongType.WY -> searchWy(keyword, isNewSearch)
                    SongType.KW -> searchKw(keyword, isNewSearch)
                    SongType.LOCAL -> {
                        _searchResults.value = emptyList()
                        isLastPage = true
                        true
                    }
                }
                if (success) {
                    _searchFailed.value = false
                } else if (isNewSearch) {
                    _searchFailed.value = true
                }
            } catch (e: Exception) {
                e.printStackTrace()
                if (isNewSearch) {
                    _searchFailed.value = true
                }
            } finally {
                _isLoadingMore.value = false
                _isLoading.value = false
                moreLoading = false
            }
        }
    }

    private fun mergeRows(isNewSearch: Boolean, chunk: List<SearchTrackRow>) {
        val newList = if (isNewSearch) {
            chunk
        } else {
            (_searchResults.value ?: emptyList()) + chunk
        }
        _searchResults.value = newList
    }

    private suspend fun searchKg(keyword: String, isNewSearch: Boolean): Boolean {
        val result = kgRepository.searchSong(keyword, kgPage)
        result.onSuccess { response ->
            val rows = response.lists.map { it.toSearchTrackRow() }
            mergeRows(isNewSearch, rows)
            kgPage++
            isLastPage = response.lists.isEmpty()
        }
        result.onFailure {
            isLastPage = true
        }
        return result.isSuccess
    }

    private suspend fun searchWy(keyword: String, isNewSearch: Boolean): Boolean {
        val limit = WY_PAGE_LIMIT
        val offset = (wyPage - 1) * limit
        val result = wyRepository.cloudSearch(keyword, limit, offset)
        result.onSuccess { songs ->
            val rows = songs.mapNotNull { it.toSearchTrackRow() }
            mergeRows(isNewSearch, rows)
            wyPage++
            isLastPage = songs.size < limit || songs.isEmpty()
        }
        result.onFailure {
            isLastPage = true
        }
        return result.isSuccess
    }

    private suspend fun searchKw(keyword: String, isNewSearch: Boolean): Boolean {
        val result = kwRepository.search(keyword, kwPage)
        result.onSuccess { list ->
            val rows = list.mapNotNull { it.toSearchTrackRow() }
            mergeRows(isNewSearch, rows)
            kwPage++
            // 酷我 /search 仅有 page，无 size；以空页作为末页，勿用固定条数推断
            isLastPage = list.isEmpty()
        }
        result.onFailure {
            isLastPage = true
        }
        return result.isSuccess
    }

    fun loadMoreResults() {
        if (!moreLoading && !isLastPage && currentKeyword.isNotEmpty()) {
            search(currentKeyword, isNewSearch = false, recordHistory = false)
        }
    }

    private fun resetPlaylistSearchState() {
        playlistPage = 1
        playlistTotal = 0
        playlistLastPage = false
        playlistKeyword = ""
        playlistMoreLoading = false
        _isPlaylistLoading.value = false
        _isPlaylistLoadingMore.value = false
        _playlistSearchFailed.value = false
        _searchPlaylistResults.value = emptyList()
    }

    fun searchPlaylist(keyword: String, isNewSearch: Boolean = true) {
        if (playlistMoreLoading) return
        if (isNewSearch) {
            if (keyword.isEmpty()) {
                playlistKeyword = ""
                playlistPage = 1
                playlistTotal = 0
                playlistLastPage = false
                _playlistSearchFailed.value = false
                _searchPlaylistResults.value = emptyList()
                return
            }
            playlistPage = 1
            playlistTotal = 0
            playlistLastPage = false
            playlistKeyword = keyword
            _playlistSearchFailed.value = false
            _searchPlaylistResults.value = emptyList()
        } else if (playlistKeyword.isEmpty()) {
            return
        }
        if (_searchSource.value == SongType.KW) {
            playlistLastPage = true
            _isPlaylistLoading.value = false
            _isPlaylistLoadingMore.value = false
            _playlistSearchFailed.value = false
            return
        }
        if (playlistLastPage) return

        playlistMoreLoading = true
        _isPlaylistLoading.value = isNewSearch
        _isPlaylistLoadingMore.value = !isNewSearch
        viewModelScope.launch {
            try {
                val pageSize = PLAYLIST_PAGE_LIMIT
                val result = when (_searchSource.value ?: SongType.KG) {
                    SongType.KG -> kgRepository.searchPlaylist(playlistKeyword, playlistPage, pageSize)
                    SongType.WY -> wyRepository.cloudSearchPlaylist(
                        keywords = playlistKeyword,
                        limit = pageSize,
                        offset = (playlistPage - 1) * pageSize,
                    )
                    else -> null
                }
                if (result == null) {
                    playlistLastPage = true
                    if (isNewSearch) {
                        _playlistSearchFailed.value = true
                    }
                    return@launch
                }
                result.onSuccess { response ->
                    val newList = if (isNewSearch) {
                        response.lists
                    } else {
                        (_searchPlaylistResults.value ?: emptyList()) + response.lists
                    }
                    _searchPlaylistResults.value = newList
                    playlistTotal = response.total
                    playlistPage++
                    playlistLastPage = response.lists.isEmpty() ||
                        (playlistTotal > 0 && newList.size >= playlistTotal)
                    _playlistSearchFailed.value = false
                }
                result.onFailure {
                    playlistLastPage = true
                    if (isNewSearch) {
                        _playlistSearchFailed.value = true
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                playlistLastPage = true
                if (isNewSearch) {
                    _playlistSearchFailed.value = true
                }
            } finally {
                playlistMoreLoading = false
                _isPlaylistLoading.value = false
                _isPlaylistLoadingMore.value = false
            }
        }
    }

    fun loadMorePlaylistResults() {
        if (!playlistMoreLoading && !playlistLastPage && playlistKeyword.isNotEmpty()) {
            searchPlaylist(playlistKeyword, isNewSearch = false)
        }
    }

    private fun addKeywordToHistory(keyword: String) {
        viewModelScope.launch {
            val prefs = getApplication<Application>().getSharedPreferences("search_history", Context.MODE_PRIVATE)

            val historySet = prefs.getStringSet("history", mutableSetOf())?.toMutableList() ?: mutableListOf()

            historySet.remove(keyword)

            historySet.add(0, keyword)

            if (historySet.size > maxHistorySize) {
                historySet.removeAt(historySet.size - 1)
            }

            prefs.edit().putStringSet("history", historySet.toSet()).apply()

            _searchHistory.value = historySet
        }
    }

    fun loadSearchHistory() {
        viewModelScope.launch {
            val prefs = getApplication<Application>().getSharedPreferences("search_history", Context.MODE_PRIVATE)
            val historySet = prefs.getStringSet("history", mutableSetOf())?.toList() ?: emptyList()
            _searchHistory.value = historySet
        }
    }

    fun clearSearchHistory() {
        viewModelScope.launch {
            val prefs = getApplication<Application>().getSharedPreferences("search_history", Context.MODE_PRIVATE)
            prefs.edit().remove("history").apply()
            _searchHistory.value = emptyList()
        }
    }

    fun deleteHistoryItem(keyword: String) {
        viewModelScope.launch {
            val prefs = getApplication<Application>().getSharedPreferences("search_history", Context.MODE_PRIVATE)
            val historySet = prefs.getStringSet("history", mutableSetOf())?.toMutableList() ?: mutableListOf()

            historySet.remove(keyword)

            prefs.edit().putStringSet("history", historySet.toSet()).apply()
            _searchHistory.value = historySet
        }
    }

    companion object {
        private const val WY_PAGE_LIMIT = 30
        private const val PLAYLIST_PAGE_LIMIT = 30
    }
}
