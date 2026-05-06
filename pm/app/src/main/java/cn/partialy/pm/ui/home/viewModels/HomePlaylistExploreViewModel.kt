package cn.partialy.pm.ui.home.viewModels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.KgPlaylistTagChild
import cn.partialy.pm.model.KgPlaylistTagParent
import cn.partialy.pm.network.repository.KgRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PlaylistParentTagUi(
    val id: Int,
    val name: String,
    val children: List<PlaylistChildTagUi> = emptyList(),
)

data class PlaylistChildTagUi(
    val id: Int,
    val name: String,
)

@HiltViewModel
class HomePlaylistExploreViewModel @Inject constructor(
    private val kgRepository: KgRepository,
) : ViewModel() {

    private val _parentTags = MutableStateFlow<List<PlaylistParentTagUi>>(emptyList())
    val parentTags: StateFlow<List<PlaylistParentTagUi>> = _parentTags

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    fun loadInitial() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val tags = kgRepository.getPlaylistTags().getOrElse { emptyList() }
                val mapped = tags.map { it.toUi() }
                _parentTags.value = mapped
            } finally {
                _isLoading.value = false
            }
        }
    }

    private fun KgPlaylistTagParent.toUi(): PlaylistParentTagUi {
        val id = tagId.toIntOrNull() ?: 0
        return PlaylistParentTagUi(
            id = id,
            name = tagName,
            children = children.sortedBy { it.sort.toIntOrNull() ?: Int.MAX_VALUE }.map { it.toUi() },
        )
    }

    private fun KgPlaylistTagChild.toUi(): PlaylistChildTagUi {
        return PlaylistChildTagUi(
            id = tagId.toIntOrNull() ?: 0,
            name = tagName,
        )
    }

}
