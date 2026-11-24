package cn.partialy.pm.ui.mine

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.toCanonicalSource
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

fun CollectedPlaylist.managementKey(): String = "${type.toCanonicalSource()}:$id"

data class PlaylistManagementState(
    val playlists: List<CollectedPlaylist> = emptyList(),
    val filtered: List<CollectedPlaylist> = emptyList(),
    val selected: Set<String> = emptySet(),
    val query: String = "",
    val source: ThirdPartySourceFilter = ThirdPartySourceFilter.ALL,
    val loaded: Boolean = false,
    val deleting: Boolean = false,
    val filtering: Boolean = false,
    val initialTarget: String? = null,
    val deleteResult: Pair<Int, Int>? = null,
)

@HiltViewModel
class PlaylistManagementViewModel @Inject constructor(
    private val manager: PlaylistCollectionManager,
    private val savedState: SavedStateHandle,
) : ViewModel() {
    private val mutableState = MutableStateFlow(PlaylistManagementState(
        query = savedState["query"] ?: "",
        source = ThirdPartySourceFilter.values().firstOrNull { it.name == savedState.get<String>("source") }
            ?: ThirdPartySourceFilter.ALL,
        selected = savedState.get<ArrayList<String>>("selected")?.toSet().orEmpty(),
    ))
    val state = mutableState.asStateFlow()
    private var filterJob: Job? = null
    private var generation = AccountSessionStore.libraryGeneration

    init {
        viewModelScope.launch {
            // 先确保磁盘索引已加载，再订阅 StateFlow，避免空初值清理恢复的选择。
            withContext(Dispatchers.IO) { manager.getAllPlaylists() }
            manager.playlistsFlow.collect { playlists ->
                if (generation != AccountSessionStore.libraryGeneration) {
                    generation = AccountSessionStore.libraryGeneration
                    saveSelection(emptySet())
                    savedState["initialApplied"] = true
                }
                val source = playlists.filter { it.type != CollectedPlaylistType.LOCAL }
                var selected = state.value.selected.intersect(source.mapTo(hashSetOf()) { it.managementKey() })
                var target = state.value.initialTarget?.takeIf { key -> source.any { it.managementKey() == key } }
                if (savedState.get<Boolean>("initialApplied") != true) {
                    val initialSource = savedState.get<String>("initialSource")
                    val initialId = savedState.get<String>("initialId")
                    target = source.firstOrNull {
                        it.type.toCanonicalSource() == initialSource && it.id == initialId
                    }?.managementKey()
                    if (target != null) selected = selected + target
                    savedState["initialApplied"] = true
                }
                saveSelection(selected)
                mutableState.value = state.value.copy(playlists = source, loaded = true, initialTarget = target)
                filter(immediate = true)
            }
        }
    }

    fun setQuery(query: String) {
        savedState["query"] = query
        mutableState.value = state.value.copy(query = query)
        filter(immediate = false)
    }

    fun setSource(source: ThirdPartySourceFilter) {
        if (state.value.deleting) return
        savedState["source"] = source.name
        mutableState.value = state.value.copy(source = source)
        filter(immediate = true)
    }

    fun toggle(playlist: CollectedPlaylist) {
        if (state.value.deleting || state.value.filtering) return
        val key = playlist.managementKey()
        saveSelection(if (key in state.value.selected) state.value.selected - key else state.value.selected + key)
    }

    fun selectAll() {
        if (!state.value.deleting && !state.value.filtering) {
            saveSelection(state.value.selected + state.value.filtered.map { it.managementKey() })
        }
    }

    fun invert() {
        if (state.value.deleting || state.value.filtering) return
        val keys = state.value.filtered.mapTo(hashSetOf()) { it.managementKey() }
        saveSelection((state.value.selected - keys) + (keys - state.value.selected))
    }

    fun selectedPlaylists(): List<CollectedPlaylist> = state.value.playlists.filter { it.managementKey() in state.value.selected }

    fun delete(playlists: List<CollectedPlaylist>, expectedGeneration: Long) {
        if (state.value.deleting || playlists.isEmpty() || expectedGeneration != AccountSessionStore.libraryGeneration) return
        mutableState.value = state.value.copy(deleting = true)
        viewModelScope.launch {
            var deleted = 0
            var failed = 0
            try {
                withContext(Dispatchers.IO) {
                    playlists.forEach { playlist ->
                        try {
                            synchronized(AccountSessionStore.libraryBoundary) {
                                // 检查和写入必须在同一账号边界内，防止切账号后误删同 ID 歌单。
                                if (expectedGeneration != AccountSessionStore.libraryGeneration) return@withContext
                                if (manager.removePlaylist(playlist.type, playlist.id)) deleted++ else failed++
                            }
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (error: Exception) {
                            cn.partialy.pm.utils.GlobalExceptionHandler.recordHandledException(
                                methodName = "PlaylistManagementViewModel.delete", throwable = error,
                            )
                            failed++
                        }
                    }
                }
                if (expectedGeneration == AccountSessionStore.libraryGeneration) {
                    mutableState.value = state.value.copy(deleteResult = deleted to failed)
                }
            } finally {
                mutableState.value = state.value.copy(deleting = false)
            }
        }
    }

    fun consumeDeleteResult() { mutableState.value = state.value.copy(deleteResult = null) }
    fun consumeInitialTarget() { mutableState.value = state.value.copy(initialTarget = null) }

    private fun saveSelection(selected: Set<String>) {
        savedState["selected"] = ArrayList(selected)
        mutableState.value = state.value.copy(selected = selected)
    }

    private fun filter(immediate: Boolean) {
        filterJob?.cancel()
        mutableState.value = state.value.copy(filtering = true)
        val snapshot = state.value
        filterJob = viewModelScope.launch {
            if (!immediate) delay(150)
            val filtered = withContext(Dispatchers.Default) {
                val query = snapshot.query.trim()
                snapshot.playlists.filter { playlist ->
                    val source = playlist.type.toCanonicalSource()
                    (snapshot.source.sourceKey == null || snapshot.source.sourceKey == source) &&
                        (query.isEmpty() || playlist.name.contains(query, true) ||
                            playlist.intro.contains(query, true) || source.contains(query, true))
                }
            }
            mutableState.value = state.value.copy(filtered = filtered, filtering = false)
        }
    }
}
