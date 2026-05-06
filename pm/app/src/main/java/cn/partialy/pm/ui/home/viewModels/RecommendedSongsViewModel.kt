package cn.partialy.pm.ui.home.viewModels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.model.RecommendSongInfo
import cn.partialy.pm.network.repository.KgRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TopCardSectionState(
    val cardId: Int,
    val title: String = "",
    val songs: List<RecommendSongInfo> = emptyList(),
    val isLoading: Boolean = false,
    val isLoaded: Boolean = false,
)

@HiltViewModel
class RecommendedSongsViewModel @Inject constructor(
    private val kgRepository: KgRepository,
) : ViewModel() {
    private val topCardIds = listOf(3, 4, 5, 6)

    private val _recommendedSongs = MutableStateFlow<List<RecommendSongInfo>>(emptyList())
    val recommendedSongs: StateFlow<List<RecommendSongInfo>> = _recommendedSongs

    private val _dailyRecommendSongs = MutableStateFlow<List<RecommendSongInfo>>(emptyList())
    val dailyRecommendSongs: StateFlow<List<RecommendSongInfo>> = _dailyRecommendSongs

    private val _recommendPlaylists = MutableStateFlow<List<HomeRecommendPlaylist>>(emptyList())
    val recommendPlaylists: StateFlow<List<HomeRecommendPlaylist>> = _recommendPlaylists

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _recommendLoadFailed = MutableStateFlow(false)
    val recommendLoadFailed: StateFlow<Boolean> = _recommendLoadFailed

    private val _topCardSections = MutableStateFlow(topCardIds.map { TopCardSectionState(cardId = it) })
    val topCardSections = _topCardSections.asStateFlow()

    private var topCardsLoading = false

    init {
        loadAll()
    }

    private fun loadAll() {
        viewModelScope.launch {
            _isLoading.value = true
            _recommendLoadFailed.value = false
            try {
                coroutineScope {
                    val songsDef = async { kgRepository.getRecommendSongs() }
                    val playlistsDef = async { kgRepository.getRecommendPlaylists() }

                    playlistsDef.await().fold(
                        onSuccess = { list -> _recommendPlaylists.value = list },
                        onFailure = { e ->
                            e.printStackTrace()
                            _recommendPlaylists.value = emptyList()
                        },
                    )

                    songsDef.await().fold(
                        onSuccess = { response ->
                            _recommendedSongs.value = response.song_list
                            _dailyRecommendSongs.value = response.song_list.take(30)
                        },
                        onFailure = { e ->
                            e.printStackTrace()
                            _recommendedSongs.value = emptyList()
                            _dailyRecommendSongs.value = emptyList()
                            _recommendLoadFailed.value = true
                        },
                    )
                }
            } catch (e: Exception) {
                e.printStackTrace()
                _recommendLoadFailed.value = true
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun refresh() {
        resetTopCards()
        loadAll()
    }

    fun loadTopCardsSequentially() {
        if (topCardsLoading) return
        if (_topCardSections.value.none { !it.isLoaded && !it.isLoading }) return

        topCardsLoading = true
        viewModelScope.launch {
            try {
                for (cardId in topCardIds) {
                    if (!isActive) return@launch
                    val current = _topCardSections.value.firstOrNull { it.cardId == cardId } ?: continue
                    if (current.isLoaded || current.isLoading) continue

                    updateTopCard(cardId) { it.copy(isLoading = true) }
                    kgRepository.getTopCardSongs(cardId).fold(
                        onSuccess = { data ->
                            updateTopCard(cardId) {
                                it.copy(
                                    title = data.recDesc,
                                    songs = data.songList.take(30),
                                    isLoading = false,
                                    isLoaded = true,
                                )
                            }
                        },
                        onFailure = { throwable ->
                            throwable.printStackTrace()
                            updateTopCard(cardId) { state ->
                                state.copy(isLoading = false, isLoaded = true)
                            }
                        },
                    )
                }
            } finally {
                topCardsLoading = false
            }
        }
    }

    private fun resetTopCards() {
        topCardsLoading = false
        _topCardSections.value = topCardIds.map { TopCardSectionState(cardId = it) }
    }

    private fun updateTopCard(cardId: Int, transform: (TopCardSectionState) -> TopCardSectionState) {
        _topCardSections.value = _topCardSections.value.map { section ->
            if (section.cardId == cardId) transform(section) else section
        }
    }
}
