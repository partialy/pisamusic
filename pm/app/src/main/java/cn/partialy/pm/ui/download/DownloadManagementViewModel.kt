package cn.partialy.pm.ui.download

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.download.task.DownloadTask
import cn.partialy.pm.download.task.DownloadTaskRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

data class DownloadManagementState(
    val tasks: List<DownloadTask> = emptyList(),
    val page: Int = 0,
    val query: String = "",
    val editing: Boolean = false,
    val selections: List<Set<String>> = listOf(emptySet(), emptySet()),
) {
    fun visibleTasks(page: Int): List<DownloadTask> = tasks.filter { task ->
        task.status.isTerminal == (page == 1) && (page == 0 || query.isBlank() ||
            task.title.contains(query, true) || task.artist.contains(query, true) || task.fileName?.contains(query, true) == true)
    }
    val selection get() = selections[page]
}

/** 选择属于页面而非过滤结果，搜索改变不丢失隐藏条目的选择。 */
@HiltViewModel
class DownloadManagementViewModel @Inject constructor(
    repository: DownloadTaskRepository,
    private val savedState: SavedStateHandle,
) : ViewModel() {
    private val ui = MutableStateFlow(DownloadManagementState(
        page = savedState["page"] ?: 0, query = savedState["query"] ?: "",
    ))
    val state = combine(repository.tasks, ui) { tasks, current ->
        current.copy(tasks = tasks, selections = current.selections.mapIndexed { page, ids ->
            ids.intersect(tasks.filter { it.status.isTerminal == (page == 1) }.map { it.id }.toSet())
        })
    }.stateIn(viewModelScope, SharingStarted.Eagerly, ui.value.copy(tasks = repository.tasks.value))

    fun selectPage(page: Int) {
        if (ui.value.editing) return
        savedState["page"] = page
        ui.value = ui.value.copy(page = page)
    }
    fun search(query: String) {
        savedState["query"] = query
        ui.value = ui.value.copy(query = query)
    }
    fun edit(enabled: Boolean, task: DownloadTask? = null) {
        val current = state.value
        val selections = current.selections.toMutableList()
        if (!enabled) selections[current.page] = emptySet()
        else if (task != null) selections[current.page] = selections[current.page] + task.id
        ui.value = ui.value.copy(editing = enabled, selections = selections)
    }
    fun toggle(id: String) {
        if (!ui.value.editing) return
        val current = state.value
        updateSelection(if (id in current.selection) current.selection - id else current.selection + id)
    }
    fun selectAll() = updateSelection(state.value.selection + state.value.visibleTasks(state.value.page).map { it.id })
    fun invert() {
        val current = state.value
        val visible = current.visibleTasks(current.page).map { it.id }.toSet()
        updateSelection((current.selection - visible) + (visible - current.selection))
    }
    private fun updateSelection(ids: Set<String>) {
        val selections = state.value.selections.toMutableList()
        selections[ui.value.page] = ids
        ui.value = ui.value.copy(selections = selections)
    }
}
