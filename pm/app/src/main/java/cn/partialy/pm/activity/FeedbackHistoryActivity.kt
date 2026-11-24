package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityFeedbackHistoryBinding
import cn.partialy.pm.feedback.FeedbackHistoryItemDto
import cn.partialy.pm.feedback.FeedbackHistoryRepository
import cn.partialy.pm.ui.feedback.FeedbackDetailBottomSheet
import cn.partialy.pm.ui.feedback.FeedbackHistoryAdapter
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.message.PmMessage
import com.google.android.material.bottomsheet.BottomSheetDialog
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class FeedbackHistoryActivity : BaseActivity() {

    private lateinit var binding: ActivityFeedbackHistoryBinding

    @Inject
    lateinit var repository: FeedbackHistoryRepository

    private lateinit var adapter: FeedbackHistoryAdapter
    private val items = mutableListOf<FeedbackHistoryItemDto>()
    private var nextOffset: Int = 0
    private var hasMore: Boolean = true
    private var isLoading: Boolean = false
    private var detailSheet: BottomSheetDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityFeedbackHistoryBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        ViewCompat.setOnApplyWindowInsetsListener(binding.feedbackHistoryRoot) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val lp = binding.feedbackHistoryStatusBarSpacer.layoutParams
            lp.height = bars.top
            binding.feedbackHistoryStatusBarSpacer.layoutParams = lp
            binding.feedbackHistoryRecyclerView.updatePadding(bottom = bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(binding.feedbackHistoryRoot)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = finish()
            },
        )

        binding.feedbackHistoryBackButton.setOnClickListener { finish() }
        binding.feedbackHistoryRetryButton.setOnClickListener { loadFirstPage() }

        setupRecyclerView()
        loadFirstPage()
    }

    override fun onDestroy() {
        detailSheet?.dismiss()
        detailSheet = null
        super.onDestroy()
    }

    private fun setupRecyclerView() {
        adapter = FeedbackHistoryAdapter(
            resolveImageUrl = { repository.resolveImageUrl(it) },
            onItemClick = { item ->
                detailSheet?.dismiss()
                detailSheet = FeedbackDetailBottomSheet.show(
                    activity = this,
                    item = item,
                    resolveImageUrl = { repository.resolveImageUrl(it) },
                )
            },
        )
        val layoutManager = LinearLayoutManager(this)
        binding.feedbackHistoryRecyclerView.layoutManager = layoutManager
        binding.feedbackHistoryRecyclerView.adapter = adapter
        binding.feedbackHistoryRecyclerView.addOnScrollListener(
            object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    if (dy <= 0) return
                    if (isLoading || !hasMore) return
                    val lastVisible = layoutManager.findLastVisibleItemPosition()
                    if (lastVisible >= items.size - 4) {
                        loadNextPage()
                    }
                }
            },
        )
    }

    private fun loadFirstPage() {
        if (isLoading) return
        isLoading = true
        nextOffset = 0
        hasMore = true
        showLoadingState()

        lifecycleScope.launch {
            try {
                val page = repository.fetchHistory(offset = 0, limit = PAGE_LIMIT)
                items.clear()
                items.addAll(page.list)
                nextOffset = page.offset + page.list.size
                hasMore = page.hasMore
                isLoading = false
                if (items.isEmpty()) {
                    showEmptyState()
                } else {
                    showListState()
                    adapter.submitItems(
                        items,
                        if (hasMore) FeedbackHistoryAdapter.FooterState.LOADING
                        else FeedbackHistoryAdapter.FooterState.NO_MORE,
                    )
                }
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                isLoading = false
                showErrorState(e.message)
            }
        }
    }

    private fun loadNextPage() {
        if (isLoading || !hasMore) return
        isLoading = true
        adapter.setFooterState(FeedbackHistoryAdapter.FooterState.LOADING)

        lifecycleScope.launch {
            try {
                val page = repository.fetchHistory(offset = nextOffset, limit = PAGE_LIMIT)
                items.addAll(page.list)
                nextOffset = page.offset + page.list.size
                hasMore = page.hasMore
                isLoading = false
                adapter.submitItems(
                    items,
                    if (hasMore) FeedbackHistoryAdapter.FooterState.LOADING
                    else FeedbackHistoryAdapter.FooterState.NO_MORE,
                )
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                isLoading = false
                adapter.setFooterState(FeedbackHistoryAdapter.FooterState.HIDDEN)
                PmMessage.error(
                    this@FeedbackHistoryActivity,
                    e.message?.takeIf { it.isNotBlank() }
                        ?: getString(R.string.feedback_history_load_failed),
                )
            }
        }
    }

    private fun showLoadingState() {
        binding.feedbackHistoryLoadingContainer.visibility = View.VISIBLE
        binding.feedbackHistoryRecyclerView.visibility = View.GONE
        binding.feedbackHistoryEmptyContainer.visibility = View.GONE
        binding.feedbackHistoryErrorContainer.visibility = View.GONE
    }

    private fun showListState() {
        binding.feedbackHistoryLoadingContainer.visibility = View.GONE
        binding.feedbackHistoryRecyclerView.visibility = View.VISIBLE
        binding.feedbackHistoryEmptyContainer.visibility = View.GONE
        binding.feedbackHistoryErrorContainer.visibility = View.GONE
    }

    private fun showEmptyState() {
        binding.feedbackHistoryLoadingContainer.visibility = View.GONE
        binding.feedbackHistoryRecyclerView.visibility = View.GONE
        binding.feedbackHistoryEmptyContainer.visibility = View.VISIBLE
        binding.feedbackHistoryErrorContainer.visibility = View.GONE
    }

    private fun showErrorState(message: String?) {
        binding.feedbackHistoryLoadingContainer.visibility = View.GONE
        binding.feedbackHistoryRecyclerView.visibility = View.GONE
        binding.feedbackHistoryEmptyContainer.visibility = View.GONE
        binding.feedbackHistoryErrorContainer.visibility = View.VISIBLE
        binding.feedbackHistoryErrorText.text =
            message?.takeIf { it.isNotBlank() } ?: getString(R.string.feedback_history_load_failed)
    }

    companion object {
        private const val PAGE_LIMIT = 20

        fun start(context: Context) {
            context.startActivity(Intent(context, FeedbackHistoryActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
