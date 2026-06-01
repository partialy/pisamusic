package cn.partialy.pm.ui.home.viewModels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.model.RecommendSongInfo
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.wy.WyRepository
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
    private val wyRepository: WyRepository,
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
                    val kgSongsDef = async { kgRepository.getRecommendSongs() }
                    val kgPlaylistsDef = async { kgRepository.getRecommendPlaylists() }
                    val wyPlaylistsDef = async { wyRepository.getRecommendPlaylists(limit = 18) }
                    val wyNewSongsDef = async { wyRepository.getRecommendNewSongs(limit = 18) }

                    val kgPlaylists = kgPlaylistsDef.await().getOrEmptyWithLog()
                    val wyPlaylists = wyPlaylistsDef.await().getOrEmptyWithLog()
                    _recommendPlaylists.value = interleave(kgPlaylists, wyPlaylists)

                    val kgSongsResult = kgSongsDef.await()
                    val kgSongs = kgSongsResult.fold(
                        onSuccess = { it.song_list },
                        onFailure = { e ->
                            e.printStackTrace()
                            emptyList()
                        },
                    )
                    val wyNewSongs = wyNewSongsDef.await().getOrEmptyWithLog()
                    val mergedSongs = interleave(kgSongs, wyNewSongs)
                    _recommendedSongs.value = mergedSongs
                    _dailyRecommendSongs.value = mergedSongs.take(30)
                    _recommendLoadFailed.value = mergedSongs.isEmpty()
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

    private fun <T> Result<List<T>>.getOrEmptyWithLog(): List<T> =
        fold(
            onSuccess = { it },
            onFailure = { e ->
                e.printStackTrace()
                emptyList()
            },
        )

    private fun <T> interleave(primary: List<T>, secondary: List<T>): List<T> {
        if (primary.isEmpty()) return secondary
        if (secondary.isEmpty()) return primary
        val merged = ArrayList<T>(primary.size + secondary.size)
        val maxSize = maxOf(primary.size, secondary.size)
        for (index in 0 until maxSize) {
            primary.getOrNull(index)?.let(merged::add)
            secondary.getOrNull(index)?.let(merged::add)
        }
        return merged
    }
}
