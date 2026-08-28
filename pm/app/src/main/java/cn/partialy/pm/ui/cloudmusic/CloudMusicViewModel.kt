package cn.partialy.pm.ui.cloudmusic

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.network.cloudmusic.CloudMusicRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class CloudMusicErrorPhase {
    FIRST_PAGE,
    LOAD_MORE,
}

data class CloudMusicLoadError(
    val phase: CloudMusicErrorPhase,
    @StringRes val messageResId: Int,
)

data class CloudMusicUiState(
    val keyword: String = "",
    val items: List<SongInfo> = emptyList(),
    val total: Int = 0,
    val latestUpdatedAt: Long? = null,
    val myContributions: Int = 0,
    val nextOffset: Int = 0,
    val hasMore: Boolean = false,
    val initialLoading: Boolean = false,
    val loadingMore: Boolean = false,
    val refreshing: Boolean = false,
    val error: CloudMusicLoadError? = null,
)

@HiltViewModel
class CloudMusicViewModel @Inject constructor(
    private val repository: CloudMusicRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(CloudMusicUiState())
    val state: StateFlow<CloudMusicUiState> = _state.asStateFlow()

    private var searchJob: Job? = null
    private var loadMoreJob: Job? = null
    private var requestGeneration = 0L

    init {
        refresh()
    }

    /** 输入变化后清空旧关键词结果；300ms 后再发起首屏请求。 */
    fun setKeyword(keyword: String) {
        val normalized = keyword.trim()
        if (normalized == _state.value.keyword && searchJob?.isActive == true) return

        val generation = nextGeneration()
        searchJob?.cancel()
        loadMoreJob?.cancel()
        _state.value = _state.value.copy(
            keyword = normalized,
            items = emptyList(),
            nextOffset = 0,
            hasMore = false,
            initialLoading = true,
            loadingMore = false,
            refreshing = false,
            error = null,
        )
        searchJob = viewModelScope.launch {
            delay(SEARCH_DEBOUNCE_MS)
            loadFirstPage(generation, normalized, preserveCurrentItems = false)
        }
    }

    /** IME 搜索时跳过输入防抖，重新加载当前关键词第一页。 */
    fun searchNow() {
        val generation = nextGeneration()
        searchJob?.cancel()
        loadMoreJob?.cancel()
        val keyword = _state.value.keyword
        searchJob = viewModelScope.launch {
            loadFirstPage(generation, keyword, preserveCurrentItems = true)
        }
    }

    /** 保留当前关键词；已有同关键词列表时显示下拉刷新进度。 */
    fun refresh() {
        val generation = nextGeneration()
        searchJob?.cancel()
        loadMoreJob?.cancel()
        val keyword = _state.value.keyword
        searchJob = viewModelScope.launch {
            loadFirstPage(generation, keyword, preserveCurrentItems = true)
        }
    }

    /** 首屏错误统一重试当前关键词，不能误当成加载更多。 */
    fun retryFirstPage() = searchNow()

    fun loadMore() {
        if (loadMoreJob?.isActive == true) return
        val snapshot = _state.value
        if (
            snapshot.initialLoading ||
            snapshot.refreshing ||
            snapshot.loadingMore ||
            !snapshot.hasMore ||
            snapshot.error?.phase == CloudMusicErrorPhase.FIRST_PAGE
        ) {
            return
        }

        val generation = requestGeneration
        val keyword = snapshot.keyword
        val offset = snapshot.nextOffset
        _state.value = snapshot.copy(loadingMore = true, error = null)
        loadMoreJob = viewModelScope.launch {
            runCatching { repository.search(keyword, offset, PAGE_SIZE) }
                .onSuccess { page ->
                    if (!isCurrent(generation)) return@onSuccess
                    val current = _state.value
                    val merged = (current.items + page.items).distinctBy(::songIdentity)
                    val nextOffset = (page.offset + page.items.size).coerceAtLeast(offset)
                    _state.value = current.copy(
                        items = merged,
                        total = page.total,
                        nextOffset = nextOffset,
                        hasMore = page.items.isNotEmpty() && nextOffset < page.total,
                        loadingMore = false,
                        error = null,
                    )
                }
                .onFailure {
                    if (!isCurrent(generation)) return@onFailure
                    _state.value = _state.value.copy(
                        loadingMore = false,
                        error = CloudMusicLoadError(
                            phase = CloudMusicErrorPhase.LOAD_MORE,
                            messageResId = R.string.cloud_music_load_more_failed,
                        ),
                    )
                }
        }
    }

    private suspend fun loadFirstPage(
        generation: Long,
        keyword: String,
        preserveCurrentItems: Boolean,
    ) {
        val before = _state.value
        val keepItems = preserveCurrentItems && before.keyword == keyword && before.items.isNotEmpty()
        _state.value = before.copy(
            items = if (keepItems) before.items else emptyList(),
            nextOffset = if (keepItems) before.nextOffset else 0,
            hasMore = if (keepItems) before.hasMore else false,
            initialLoading = !keepItems,
            refreshing = keepItems,
            loadingMore = false,
            error = null,
        )
        runCatching {
            coroutineScope {
                val summary = async { repository.getSummary() }
                val page = async { repository.search(keyword, 0, PAGE_SIZE) }
                summary.await() to page.await()
            }
        }.onSuccess { (summary, page) ->
            if (!isCurrent(generation)) return@onSuccess
            val nextOffset = page.offset + page.items.size
            _state.value = _state.value.copy(
                keyword = keyword,
                items = page.items.distinctBy(::songIdentity),
                total = summary.total,
                latestUpdatedAt = summary.latestUpdatedAt,
                myContributions = summary.myContributions,
                nextOffset = nextOffset,
                hasMore = page.items.isNotEmpty() && nextOffset < page.total,
                initialLoading = false,
                refreshing = false,
                loadingMore = false,
                error = null,
            )
        }.onFailure {
            if (!isCurrent(generation)) return@onFailure
            _state.value = _state.value.copy(
                initialLoading = false,
                refreshing = false,
                loadingMore = false,
                error = CloudMusicLoadError(
                    phase = CloudMusicErrorPhase.FIRST_PAGE,
                    messageResId = R.string.cloud_music_load_failed,
                ),
            )
        }
    }

    private fun songIdentity(song: SongInfo): String = "${song.type.name}:${song.id}"

    private fun nextGeneration(): Long = ++requestGeneration

    private fun isCurrent(generation: Long): Boolean = generation == requestGeneration

    private companion object {
        const val PAGE_SIZE = 20
        const val SEARCH_DEBOUNCE_MS = 300L
    }
}
