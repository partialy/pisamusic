package cn.partialy.pm.ui.download

import android.os.Bundle
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.content.Context
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.fragment.app.activityViewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.DownloadManagementActivity
import cn.partialy.pm.databinding.FragmentDownloadTaskPageBinding
import cn.partialy.pm.model.SongType
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

class DownloadTaskPageFragment : Fragment(R.layout.fragment_download_task_page) {
    private val model: DownloadManagementViewModel by activityViewModels()
    private var binding: FragmentDownloadTaskPageBinding? = null
    private var taskAdapter: DownloadTaskAdapter? = null
    private val page get() = requireArguments().getInt("page")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val views = FragmentDownloadTaskPageBinding.bind(view)
        binding = views
        val host = requireActivity() as DownloadManagementActivity
        val adapter = DownloadTaskAdapter(
            onTaskClick = { if (model.state.value.editing) model.toggle(it.id) else host.onDownloadTaskClick(it.id) },
            onTaskLongClick = { model.edit(true, it) },
            onTrailingClick = { host.onDownloadTaskTrailingClick(it.id) },
            onToggleSelection = model::toggle,
        )
        taskAdapter = adapter
        views.taskRecyclerView.layoutManager = LinearLayoutManager(requireContext())
        views.taskRecyclerView.adapter = adapter
        views.taskRecyclerView.itemAnimator = null
        adapter.stateRestorationPolicy = androidx.recyclerview.widget.RecyclerView.Adapter.StateRestorationPolicy.PREVENT_WHEN_EMPTY
        views.searchField.isVisible = page == 1
        views.searchInput.setText(model.state.value.query)
        views.searchInput.doAfterTextChanged { model.search(it?.toString().orEmpty()) }
        views.searchInput.setOnFocusChangeListener { v, focused ->
            if (!focused) (requireContext().getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)?.hideSoftInputFromWindow(v.windowToken, 0)
        }
        views.clearSearchButton.setOnClickListener { views.searchInput.text.clear(); views.searchInput.clearFocus() }
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                combine(model.state, host.musicController.currentSong, host.musicController.isPlaying) { state, song, playing -> Triple(state, song, playing) }
                    .collect { (state, song, playing) ->
                        val tasks = state.visibleTasks(page)
                        adapter.submitTasks(tasks)
                        adapter.renderState(state.editing && state.page == page, state.selections[page], song?.takeIf { it.type == SongType.LOCAL }?.id, playing)
                        adapter.setPageActive(isResumed && state.page == page)
                        views.emptyView.isVisible = tasks.isEmpty()
                        views.emptyView.setText(if (page == 0) R.string.download_management_empty_downloading else R.string.download_management_empty_completed)
                        views.clearSearchButton.isVisible = state.query.isNotEmpty()
                        if (state.page != page) views.searchInput.clearFocus()
                    }
            }
        }
    }
    override fun onResume() {
        super.onResume()
        taskAdapter?.setPageActive(model.state.value.page == page)
        // 从文件管理器等外部页面返回时，刷新派生文件丢失状态，不改写历史主状态。
        taskAdapter?.let { it.notifyItemRangeChanged(0, it.itemCount, "file") }
    }
    override fun onPause() { taskAdapter?.setPageActive(false); super.onPause() }
    override fun onDestroyView() {
        taskAdapter?.setPageActive(false)
        binding?.taskRecyclerView?.adapter = null
        taskAdapter = null; binding = null
        super.onDestroyView()
    }
    companion object {
        fun create(page: Int) = DownloadTaskPageFragment().apply { arguments = Bundle().apply { putInt("page", page) } }
    }
}
