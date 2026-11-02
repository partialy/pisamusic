package cn.partialy.pm.ui.playlistedit

import android.content.Context
import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

enum class PlaylistEditError { NOT_FOUND, NAME_REQUIRED, NAME_TOO_LONG, DESCRIPTION_TOO_LONG, IMAGE_FAILED, SAVE_FAILED }

data class PlaylistEditState(
    val name: String = "",
    val description: String = "",
    val cover: String = "",
    val loading: Boolean = true,
    val busy: Boolean = false,
    val saving: Boolean = false,
    val saved: Boolean = false,
    val hasChanges: Boolean = false,
    val error: PlaylistEditError? = null,
)

@HiltViewModel
class PlaylistEditViewModel @Inject constructor(
    @ApplicationContext context: Context,
    private val manager: PlaylistCollectionManager,
    private val savedState: SavedStateHandle,
) : ViewModel() {
    private val covers = PlaylistEditCoverFiles(context)
    private val mutableState = MutableStateFlow(PlaylistEditState())
    val state = mutableState.asStateFlow()
    private var playlistId = ""
    private var initialized = false
    private var cleared = false

    fun initialize(id: String) {
        if (initialized) return
        initialized = true
        playlistId = id
        viewModelScope.launch {
            val playlist = withContext(Dispatchers.IO) {
                runCatching { manager.getCollectedPlaylist(CollectedPlaylistType.LOCAL, id) }.getOrNull()
            }
            if (playlist == null) {
                mutableState.value = PlaylistEditState(loading = false, error = PlaylistEditError.NOT_FOUND)
                return@launch
            }
            if (savedState.get<String>("playlistId") != id) {
                savedState["playlistId"] = id
                savedState["originalName"] = playlist.name
                savedState["originalDescription"] = playlist.intro
                savedState["originalCover"] = playlist.cover
                savedState["name"] = playlist.name
                savedState["description"] = playlist.intro
                savedState["cover"] = playlist.cover
                savedState["saved"] = false
            }
            publish(PlaylistEditState(
                name = savedState["name"] ?: playlist.name,
                description = savedState["description"] ?: playlist.intro,
                cover = savedState["cover"] ?: playlist.cover,
                loading = false,
                saved = savedState["saved"] ?: false,
            ))
        }
    }

    fun setName(value: String) {
        if (canEdit()) publish(state.value.copy(name = value))
    }

    fun setDescription(value: String) {
        if (canEdit()) publish(state.value.copy(description = value))
    }

    fun selectCover(value: String) {
        if (!canEdit()) return
        val previous = state.value.cover
        publish(state.value.copy(cover = value))
        if (previous != value) covers.deleteTemporary(previous)
    }

    fun selectImage(uri: Uri) {
        if (!canEdit()) return
        mutableState.value = state.value.copy(busy = true, error = null)
        viewModelScope.launch {
            var producedCover: String? = null
            try {
                // 临时图生成很短，完成后统一清理，避免离页取消留下半写文件。
                val result = withContext(NonCancellable + Dispatchers.IO) {
                    runCatching { covers.normalize(uri).also { producedCover = it } }
                }
                result.onSuccess { cover ->
                    val previous = state.value.cover
                    publish(state.value.copy(cover = cover, busy = false))
                    covers.deleteTemporary(previous)
                }.onFailure {
                    mutableState.value = state.value.copy(busy = false, error = PlaylistEditError.IMAGE_FAILED)
                }
            } finally {
                if (cleared) {
                    producedCover?.let(covers::deleteTemporary)
                    covers.deleteTemporary(state.value.cover)
                }
            }
        }
    }

    fun save() {
        if (!canEdit()) return
        val draft = state.value
        val name = draft.name.trim()
        val error = when {
            name.isBlank() -> PlaylistEditError.NAME_REQUIRED
            name.length > 50 -> PlaylistEditError.NAME_TOO_LONG
            draft.description.length > 500 -> PlaylistEditError.DESCRIPTION_TOO_LONG
            else -> null
        }
        if (error != null) {
            mutableState.value = draft.copy(error = error)
            return
        }
        if (!draft.hasChanges) {
            savedState["saved"] = true
            mutableState.value = draft.copy(saved = true)
            return
        }
        mutableState.value = draft.copy(busy = true, saving = true, error = null)
        viewModelScope.launch {
            try {
                val result = withContext(NonCancellable + Dispatchers.IO) {
                    runCatching { commitMetadata(draft, name) }
                }
                result.onSuccess { cover ->
                    savedState["saved"] = true
                    publish(state.value.copy(cover = cover, busy = false, saving = false, saved = true))
                }.onFailure {
                    mutableState.value = state.value.copy(busy = false, saving = false, error = PlaylistEditError.SAVE_FAILED)
                }
            } finally {
                if (cleared) covers.deleteTemporary(draft.cover)
            }
        }
    }

    private fun commitMetadata(draft: PlaylistEditState, name: String): String {
        val previous = manager.getCollectedPlaylist(CollectedPlaylistType.LOCAL, playlistId)
            ?: error("歌单不存在")
        val newFile = covers.persist(draft.cover)
        val nextCover = newFile?.let { MinePlaylistCoverResolver.storageValueForAbsolutePath(it.absolutePath) } ?: draft.cover
        try {
            val changed = manager.updateLocalPlaylistMeta(playlistId, name, draft.description, nextCover)
            check(changed || manager.getCollectedPlaylist(CollectedPlaylistType.LOCAL, playlistId)?.let {
                it.name == name && it.intro == draft.description && it.cover == nextCover
            } == true) { "保存歌单失败" }
        } catch (error: Exception) {
            newFile?.delete()
            throw error
        }
        // 清理错误不能把已经提交的元信息变更误报成保存失败。
        runCatching {
            covers.deletePersistentIfUnused(previous.cover, manager.getAllPlaylists().map { it.cover })
            covers.deleteTemporary(draft.cover)
        }
        return nextCover
    }

    fun consumeError() {
        mutableState.value = state.value.copy(error = null)
    }

    fun discard() {
        if (state.value.busy) return
        covers.deleteTemporary(state.value.cover)
    }

    private fun canEdit(): Boolean = !state.value.loading && !state.value.busy && !state.value.saved &&
        savedState.get<String>("playlistId") == playlistId

    private fun publish(next: PlaylistEditState) {
        savedState["name"] = next.name
        savedState["description"] = next.description
        savedState["cover"] = next.cover
        mutableState.value = next.copy(hasChanges = next.name.trim() != savedState.get<String>("originalName") ||
            next.description != savedState.get<String>("originalDescription") ||
            next.cover != savedState.get<String>("originalCover"))
    }

    override fun onCleared() {
        cleared = true
        if (!state.value.busy) covers.deleteTemporary(state.value.cover)
        super.onCleared()
    }
}
