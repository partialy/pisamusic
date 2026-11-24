package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.widget.PopupWindow
import androidx.activity.addCallback
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityThirdPartyPlaylistImportBinding
import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.cookie.ThirdPartyCandidateSnapshot
import cn.partialy.pm.network.cookie.ThirdPartyPlaylistCandidate
import cn.partialy.pm.network.cookie.ThirdPartyPlaylistImportRepository
import cn.partialy.pm.network.cookie.ThirdPartyPullOutcome
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.ui.mine.ThirdPartyPlaylistImportAdapter
import cn.partialy.pm.ui.mine.ThirdPartyPlaylistImportRules
import cn.partialy.pm.ui.mine.PlaylistSourceFilterPopup
import cn.partialy.pm.ui.mine.ThirdPartySourceFilter
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * 三方账号（KG/WY）歌单候选缓存浏览、筛选、反选与增量导入页。
 */
@AndroidEntryPoint
class ThirdPartyPlaylistImportActivity : BaseActivity() {

    @Inject
    lateinit var importRepository: ThirdPartyPlaylistImportRepository

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityThirdPartyPlaylistImportBinding
    private lateinit var adapter: ThirdPartyPlaylistImportAdapter

    private var candidateItems: List<ThirdPartyPlaylistCandidate> = emptyList()
    private var filteredItems: List<ThirdPartyPlaylistCandidate> = emptyList()
    private var importedKeys: Set<String> = emptySet()
    private val selectedKeys = linkedSetOf<String>()
    private var activeSourceFilter = ThirdPartySourceFilter.ALL

    private var pulling = false
    private var importing = false
    private var initialLoaded = false
    private var filterJob: Job? = null
    private var pullJob: Job? = null
    private var sourcePopup: PopupWindow? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityThirdPartyPlaylistImportBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !isNight, lightNavigationBarIcons = !isNight)
        applyInsets()

        if (savedInstanceState != null) {
            savedInstanceState.getString(STATE_SOURCE_FILTER)?.let { name ->
                activeSourceFilter = runCatching { ThirdPartySourceFilter.valueOf(name) }
                    .getOrDefault(ThirdPartySourceFilter.ALL)
            }
            savedInstanceState.getStringArrayList(STATE_SELECTED_KEYS)?.let { restored ->
                selectedKeys.addAll(restored)
            }
        }

        setupHeader()
        setupFilterBar(savedInstanceState?.getString(STATE_QUERY).orEmpty())
        setupList()
        setupActions()
        onBackPressedDispatcher.addCallback(this) { finishAnimated() }

        observeCollectedPlaylists()
        loadInitialSnapshot()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(STATE_SOURCE_FILTER, activeSourceFilter.name)
        outState.putString(STATE_QUERY, binding.searchInput.text?.toString().orEmpty())
        outState.putStringArrayList(STATE_SELECTED_KEYS, ArrayList(selectedKeys))
    }

    override fun onDestroy() {
        sourcePopup?.dismiss()
        sourcePopup = null
        super.onDestroy()
    }

    private fun applyInsets() {
        binding.root.applySystemBarsInsets(protectIme = true) { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.actionSurface.setPadding(0, 0, 0, insets.bottom)
        }
    }

    private fun setupHeader() {
        binding.backButton.setOnClickListener { finishAnimated() }
        binding.refreshButton.setOnClickListener {
            if (!busy()) {
                triggerRefresh(targetSources = importRepository.loggedInSources(), autoTriggered = false)
            }
        }
        binding.statusRow.setOnClickListener {
            if (!busy()) {
                triggerRefresh(targetSources = importRepository.loggedInSources(), autoTriggered = false)
            }
        }
    }

    private fun setupFilterBar(initialQuery: String) {
        if (initialQuery.isNotEmpty()) {
            binding.searchInput.setText(initialQuery)
        }
        binding.clearSearchButton.isVisible = !binding.searchInput.text.isNullOrEmpty()
        binding.clearSearchButton.setOnClickListener { binding.searchInput.text?.clear() }
        binding.searchInput.doAfterTextChanged { editable ->
            binding.clearSearchButton.isVisible = !editable.isNullOrEmpty()
            scheduleFilter()
        }
        updateSourcePillLabel()
        binding.sourceFilterCard.setOnClickListener {
            if (!busy()) showSourceFilterPopup()
        }
    }

    private fun setupList() {
        adapter = ThirdPartyPlaylistImportAdapter { candidate ->
            if (busy()) return@ThirdPartyPlaylistImportAdapter
            val key = candidate.key()
            if (key in importedKeys) return@ThirdPartyPlaylistImportAdapter
            if (!selectedKeys.add(key)) {
                selectedKeys.remove(key)
            }
            render()
        }
        binding.playlistRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@ThirdPartyPlaylistImportActivity)
            adapter = this@ThirdPartyPlaylistImportActivity.adapter
            itemAnimator = null
        }
    }

    private fun setupActions() {
        binding.allAction.setOnClickListener {
            if (busy()) return@setOnClickListener
            val next = ThirdPartyPlaylistImportRules.selectAllImportable(
                filtered = filteredItems,
                importedKeys = importedKeys,
                currentSelected = selectedKeys,
            )
            selectedKeys.clear()
            selectedKeys.addAll(next)
            render()
        }
        binding.invertAction.setOnClickListener {
            if (busy()) return@setOnClickListener
            val next = ThirdPartyPlaylistImportRules.invertImportable(
                filtered = filteredItems,
                importedKeys = importedKeys,
                currentSelected = selectedKeys,
            )
            selectedKeys.clear()
            selectedKeys.addAll(next)
            render()
        }
        binding.importAction.setOnClickListener {
            importSelectedCandidates()
        }
    }

    private fun observeCollectedPlaylists() {
        lifecycleScope.launch {
            val initial = withContext(Dispatchers.IO) { playlistCollectionManager.getAllPlaylists() }
            applyCollectedKeys(ThirdPartyPlaylistImportRules.collectedKeySet(initial))
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                playlistCollectionManager.playlistsFlow.collect { playlists ->
                    applyCollectedKeys(ThirdPartyPlaylistImportRules.collectedKeySet(playlists))
                }
            }
        }
    }

    private fun applyCollectedKeys(nextImported: Set<String>) {
        importedKeys = nextImported
        val retained = ThirdPartyPlaylistImportRules.retainValidSelection(
            allCandidates = candidateItems,
            importedKeys = importedKeys,
            currentSelected = selectedKeys,
        )
        selectedKeys.clear()
        selectedKeys.addAll(retained)
        render()
    }

    private fun loadInitialSnapshot() {
        lifecycleScope.launch {
            val snapshot = importRepository.readSnapshot()
            initialLoaded = true
            applySnapshot(snapshot)
            val loggedIn = importRepository.loggedInSources()
            if (loggedIn.isEmpty()) return@launch
            if (!snapshot.hasAnyCache()) {
                triggerRefresh(targetSources = loggedIn, autoTriggered = true)
            } else {
                val missingSources = loggedIn.filter { !snapshot.hasCacheFor(it) }
                if (missingSources.isNotEmpty()) {
                    triggerRefresh(targetSources = missingSources, autoTriggered = true)
                }
            }
        }
    }

    private fun applySnapshot(snapshot: ThirdPartyCandidateSnapshot) {
        candidateItems = snapshot.items
        val retained = ThirdPartyPlaylistImportRules.retainValidSelection(
            allCandidates = candidateItems,
            importedKeys = importedKeys,
            currentSelected = selectedKeys,
        )
        selectedKeys.clear()
        selectedKeys.addAll(retained)
        filteredItems = ThirdPartyPlaylistImportRules.filterCandidates(
            items = candidateItems,
            sourceFilter = activeSourceFilter,
            query = binding.searchInput.text?.toString().orEmpty(),
        )
        render()
    }

    private fun triggerRefresh(targetSources: List<String>, autoTriggered: Boolean) {
        if (pulling || importing) return
        if (targetSources.isEmpty()) {
            PmMessage.warning(this, R.string.third_party_import_empty_login)
            return
        }
        pullJob?.cancel()
        pulling = true
        render()
        pullJob = lifecycleScope.launch {
            try {
                when (val outcome = importRepository.pullCandidates(targetSources)) {
                    is ThirdPartyPullOutcome.NoLogin -> {
                        applySnapshot(outcome.snapshot)
                        if (!autoTriggered) {
                            PmMessage.warning(this@ThirdPartyPlaylistImportActivity, R.string.third_party_import_empty_login)
                        }
                    }
                    is ThirdPartyPullOutcome.Success -> {
                        applySnapshot(outcome.snapshot)
                        if (!autoTriggered) {
                            PmMessage.success(
                                this@ThirdPartyPlaylistImportActivity,
                                getString(R.string.third_party_import_refresh_done, outcome.snapshot.items.size),
                            )
                        }
                    }
                    is ThirdPartyPullOutcome.PartialFailure -> {
                        applySnapshot(outcome.snapshot)
                        PmMessage.warning(
                            this@ThirdPartyPlaylistImportActivity,
                            R.string.third_party_import_partial_failed,
                            durationMs = 3500L,
                        )
                    }
                    is ThirdPartyPullOutcome.AllFailed -> {
                        applySnapshot(outcome.snapshot)
                        PmMessage.warning(
                            this@ThirdPartyPlaylistImportActivity,
                            R.string.third_party_import_all_failed,
                            durationMs = 3500L,
                        )
                    }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (err: Throwable) {
                cn.partialy.pm.utils.GlobalExceptionHandler.recordHandledException(
                    methodName = "ThirdPartyPlaylistImportActivity.triggerRefresh",
                    throwable = err,
                )
                PmMessage.warning(this@ThirdPartyPlaylistImportActivity, R.string.third_party_import_all_failed)
            } finally {
                pulling = false
                if (!isDestroyed) render()
            }
        }
    }

    private fun importSelectedCandidates() {
        if (busy()) return
        val targets = ThirdPartyPlaylistImportRules.resolveSelectedCandidates(
            allCandidates = candidateItems,
            importedKeys = importedKeys,
            selectedKeys = selectedKeys,
        )
        if (targets.isEmpty()) return
        importing = true
        render()
        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    playlistCollectionManager.addNetworkPlaylists(targets.map { it.toCollectedPlaylist() })
                }
                targets.forEach { selectedKeys.remove(it.key()) }
                PmMessage.success(
                    this@ThirdPartyPlaylistImportActivity,
                    getString(R.string.drawer_import_all_done, result.added, result.skipped),
                    durationMs = 3500L,
                )
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (err: Throwable) {
                cn.partialy.pm.utils.GlobalExceptionHandler.recordHandledException(
                    methodName = "ThirdPartyPlaylistImportActivity.importSelectedCandidates",
                    throwable = err,
                )
                PmMessage.error(this@ThirdPartyPlaylistImportActivity, R.string.drawer_import_all_failed)
            } finally {
                importing = false
                if (!isDestroyed) render()
            }
        }
    }

    private fun scheduleFilter() {
        filterJob?.cancel()
        val snapshot = candidateItems
        val sourceFilter = activeSourceFilter
        val query = binding.searchInput.text?.toString().orEmpty()
        filterJob = lifecycleScope.launch {
            delay(FILTER_DEBOUNCE_MS)
            filteredItems = withContext(Dispatchers.Default) {
                ThirdPartyPlaylistImportRules.filterCandidates(snapshot, sourceFilter, query)
            }
            render()
        }
    }

    private fun showSourceFilterPopup() {
        sourcePopup?.dismiss()
        val counts = ThirdPartySourceFilter.values().associateWith { filter ->
            candidateItems.count { filter.sourceKey == null || it.source == filter.sourceKey }
        }
        sourcePopup = PlaylistSourceFilterPopup.show(binding.sourceFilterCard, activeSourceFilter, counts) { filter ->
            if (activeSourceFilter != filter) {
                activeSourceFilter = filter
                updateSourcePillLabel()
                scheduleFilter()
            }
        }
    }

    private fun updateSourcePillLabel() {
        binding.sourceFilterLabel.setText(PlaylistSourceFilterPopup.labelRes(activeSourceFilter))
    }

    private fun render() {
        val rows = ThirdPartyPlaylistImportRules.buildRows(
            filtered = filteredItems,
            importedKeys = importedKeys,
            selectedKeys = selectedKeys,
        )
        adapter.submitList(rows)

        val totalImportable = candidateItems.count { it.key() !in importedKeys }
        val filteredImportable = filteredItems.count { it.key() !in importedKeys }
        val selectedCount = selectedKeys.size

        binding.selectionCounterTextView.text = getString(
            R.string.local_playlist_management_selection_count,
            selectedCount,
            totalImportable,
        )

        val isBusy = busy()
        binding.refreshButton.isEnabled = !isBusy
        binding.refreshButton.alpha = if (isBusy) DISABLED_ALPHA else 1f
        binding.statusRow.isEnabled = !isBusy
        binding.statusProgressBar.isVisible = isBusy
        binding.statusTextView.text = when {
            pulling -> getString(R.string.third_party_import_status_pulling)
            importing -> getString(R.string.third_party_import_status_importing)
            candidateItems.isNotEmpty() -> getString(
                R.string.third_party_import_status_cached,
                candidateItems.size,
                totalImportable,
            )
            else -> getString(R.string.third_party_import_status_empty)
        }

        val hasRows = rows.isNotEmpty()
        binding.playlistRecyclerView.isVisible = hasRows
        binding.emptyContainer.isVisible = !hasRows && initialLoaded
        binding.emptyLoadingBar.isVisible = !hasRows && pulling
        binding.emptyTextView.text = when {
            pulling -> getString(R.string.third_party_import_status_pulling)
            !importRepository.hasAnyThirdPartyLogin() && candidateItems.isEmpty() ->
                getString(R.string.third_party_import_empty_login)
            binding.searchInput.text?.isNotBlank() == true || activeSourceFilter != ThirdPartySourceFilter.ALL ->
                getString(R.string.third_party_import_empty_search)
            else -> getString(R.string.third_party_import_empty)
        }

        val canBatchSelect = !isBusy && filteredImportable > 0
        binding.allAction.isEnabled = canBatchSelect
        binding.allAction.alpha = if (canBatchSelect) 1f else DISABLED_ALPHA
        binding.invertAction.isEnabled = canBatchSelect
        binding.invertAction.alpha = if (canBatchSelect) 1f else DISABLED_ALPHA

        val canImport = !isBusy && selectedCount > 0
        binding.importAction.isEnabled = canImport
        binding.importAction.alpha = if (canImport) 1f else DISABLED_ALPHA
        binding.importActionText.text = if (selectedCount > 0) {
            getString(R.string.third_party_import_action_count, selectedCount)
        } else {
            getString(R.string.third_party_import_action)
        }
    }

    private fun busy(): Boolean = pulling || importing

    private fun finishAnimated() {
        finish()
        AppActivityTransitions.applyBack(this)
    }

    companion object {
        private const val FILTER_DEBOUNCE_MS = 150L
        private const val DISABLED_ALPHA = 0.4f
        private const val STATE_SOURCE_FILTER = "third_party_source_filter"
        private const val STATE_QUERY = "third_party_query"
        private const val STATE_SELECTED_KEYS = "third_party_selected_keys"

        fun start(context: Context) {
            context.startActivity(Intent(context, ThirdPartyPlaylistImportActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
