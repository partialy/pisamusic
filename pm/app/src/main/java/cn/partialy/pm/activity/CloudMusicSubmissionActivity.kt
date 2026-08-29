package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.text.format.Formatter
import android.view.View
import android.widget.TextView
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityCloudMusicSubmissionBinding
import cn.partialy.pm.databinding.DialogImagePreviewBinding
import cn.partialy.pm.databinding.IncludeCloudMusicSubmissionEditorBinding
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionFile
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionFileKind
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionInput
import cn.partialy.pm.network.cloudmusic.CloudMusicUploadPhase
import cn.partialy.pm.ui.cloudmusic.submission.CloudMusicSubmissionEditorMode
import cn.partialy.pm.ui.cloudmusic.submission.CloudMusicSubmissionEvent
import cn.partialy.pm.ui.cloudmusic.submission.CloudMusicSubmissionHistoryAdapter
import cn.partialy.pm.ui.cloudmusic.submission.CloudMusicSubmissionSection
import cn.partialy.pm.ui.cloudmusic.submission.CloudMusicSubmissionStage
import cn.partialy.pm.ui.cloudmusic.submission.CloudMusicSubmissionUiState
import cn.partialy.pm.ui.cloudmusic.submission.CloudMusicSubmissionViewModel
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import dagger.hilt.android.AndroidEntryPoint
import java.util.Locale
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/** 云盘投稿中心；首次投稿与后续重审共用同一编辑器。 */
@AndroidEntryPoint
class CloudMusicSubmissionActivity : BaseActivity() {

    private lateinit var binding: ActivityCloudMusicSubmissionBinding
    private lateinit var editorBinding: IncludeCloudMusicSubmissionEditorBinding
    private lateinit var historyAdapter: CloudMusicSubmissionHistoryAdapter
    private val viewModel: CloudMusicSubmissionViewModel by viewModels()

    private var requestedSection = CloudMusicSubmissionSection.SUBMIT
    private var boundEditorKey: String? = null

    private val audioPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { viewModel.resolveAndSelectFile(it, CloudMusicSubmissionFileKind.AUDIO) }
    }

    private val coverPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { viewModel.resolveAndSelectFile(it, CloudMusicSubmissionFileKind.COVER) }
    }

    private val lyricsPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { viewModel.resolveAndSelectFile(it, CloudMusicSubmissionFileKind.LYRICS) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityCloudMusicSubmissionBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)
        editorBinding = IncludeCloudMusicSubmissionEditorBinding.bind(
            binding.root.findViewById<View>(R.id.cloudMusicSubmissionEditorRoot),
        )
        if (savedInstanceState == null) {
            val initialSectionName = intent?.getStringExtra(EXTRA_INITIAL_SECTION)
            val initialSection = initialSectionName?.let { name ->
                runCatching { CloudMusicSubmissionSection.valueOf(name) }.getOrNull()
            } ?: CloudMusicSubmissionSection.SUBMIT
            requestedSection = initialSection
            if (initialSection != CloudMusicSubmissionSection.SUBMIT) {
                viewModel.selectSection(initialSection)
            }
        } else {
            requestedSection = viewModel.state.value.section
        }

        setupSystemBars()
        setupHistoryList()
        bindActions()
        observeViewModel()
    }

    override fun onResume() {
        super.onResume()
        val wasLoggedIn = viewModel.state.value.loggedIn
        viewModel.refreshLoginState()
        if (!wasLoggedIn && viewModel.state.value.loggedIn) {
            viewModel.selectSection(requestedSection)
        }
    }

    private fun bindActions() {
        onBackPressedDispatcher.addCallback(this) { viewModel.handleBack() }
        binding.cloudMusicSubmissionBackButton.setOnClickListener { viewModel.handleBack() }

        binding.submissionSubmitTabContainer.setOnClickListener {
            requestedSection = CloudMusicSubmissionSection.SUBMIT
            viewModel.selectSection(requestedSection)
        }
        binding.submissionHistoryTabContainer.setOnClickListener {
            requestedSection = CloudMusicSubmissionSection.HISTORY
            viewModel.selectSection(requestedSection)
        }
        binding.submissionLoginButton.setOnClickListener { LoginActivity.start(this) }

        binding.submissionAudioPickBox.setOnClickListener { openAudioPicker() }
        binding.submissionAudioPreviewBox.setOnClickListener { openAudioPicker() }
        binding.submissionAudioDeleteButton.setOnClickListener { viewModel.selectAudio(null) }

        binding.submissionCoverPickBox.setOnClickListener { openCoverPicker() }
        binding.submissionCoverPreviewBox.setOnClickListener {
            viewModel.state.value.cover?.uri?.let { uri -> showCoverPreviewDialog(coverUri = uri) }
        }
        binding.submissionCoverDeleteButton.setOnClickListener { viewModel.selectCover(null) }

        binding.submissionLyricsPickBox.setOnClickListener { openLyricsPicker() }
        binding.submissionLyricsPreviewBox.setOnClickListener { openLyricsPicker() }
        binding.submissionLyricsDeleteButton.setOnClickListener { viewModel.selectLyrics(null) }

        binding.submissionUploadExtractButton.setOnClickListener { viewModel.uploadAndExtract() }

        editorBinding.editorCoverPreview.setOnClickListener {
            val pendingCoverUri = viewModel.state.value.cover?.uri
            val editingTrackCoverUrl = viewModel.state.value.editingTrack?.cover?.url
            if (pendingCoverUri != null) {
                showCoverPreviewDialog(coverUri = pendingCoverUri)
            } else if (!editingTrackCoverUrl.isNullOrBlank()) {
                showCoverPreviewDialog(coverUrl = editingTrackCoverUrl)
            }
        }
        editorBinding.editorSelectCoverButton.setOnClickListener { openCoverPicker() }
        editorBinding.editorRemoveCoverButton.setOnClickListener { viewModel.removeCover() }
        editorBinding.editorSelectLyricsButton.setOnClickListener { openLyricsPicker() }
        editorBinding.editorClearLyricsButton.setOnClickListener { viewModel.selectLyrics(null) }
        editorBinding.editorSubmitButton.setOnClickListener { submitEditor() }

        editorBinding.editorTitleEditText.doAfterTextChanged { editorBinding.editorTitleLayout.error = null }
        editorBinding.editorArtistEditText.doAfterTextChanged { editorBinding.editorArtistLayout.error = null }
        editorBinding.editorAlbumEditText.doAfterTextChanged { editorBinding.editorAlbumLayout.error = null }
        editorBinding.editorDurationEditText.doAfterTextChanged { editorBinding.editorDurationLayout.error = null }

        binding.submissionContinueButton.setOnClickListener {
            requestedSection = CloudMusicSubmissionSection.SUBMIT
            viewModel.startNewSubmission()
        }
        binding.submissionViewHistoryButton.setOnClickListener {
            requestedSection = CloudMusicSubmissionSection.HISTORY
            viewModel.openLatestHistory()
        }
        binding.submissionHistoryEmptyAction.setOnClickListener {
            requestedSection = CloudMusicSubmissionSection.SUBMIT
            viewModel.selectSection(requestedSection)
        }
        binding.submissionHistoryRetryButton.setOnClickListener {
            viewModel.retryHistoryFirstPage()
        }
        binding.submissionHistoryFooterRetryButton.setOnClickListener {
            val state = viewModel.state.value
            if (state.historyLoadMoreError != null) {
                viewModel.retryHistoryLoadMore()
            } else {
                viewModel.refreshHistory()
            }
        }
    }

    private fun setupHistoryList() {
        historyAdapter = CloudMusicSubmissionHistoryAdapter(
            onResubmitClick = viewModel::openResubmission,
            onItemBound = viewModel::onHistoryItemVisible,
        )
        binding.submissionHistoryRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@CloudMusicSubmissionActivity)
            adapter = historyAdapter
            itemAnimator = null
        }
        binding.submissionHistorySwipeRefresh.apply {
            setColorSchemeResources(R.color.primary)
            setOnRefreshListener(viewModel::refreshHistory)
        }
    }

    private fun observeViewModel() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.state.collectLatest(::renderState)
                }
                launch {
                    viewModel.events.collect { event ->
                        when (event) {
                            CloudMusicSubmissionEvent.SubmissionChanged -> setResult(RESULT_OK)
                            CloudMusicSubmissionEvent.CloseRequested -> finish()
                            is CloudMusicSubmissionEvent.ShowMessage -> showMessage(event.message)
                        }
                    }
                }
            }
        }
    }

    private fun renderState(state: CloudMusicSubmissionUiState) {
        if (state.stage == CloudMusicSubmissionStage.SUCCESS) {
            setResult(RESULT_OK)
        }
        val busy = state.operationInProgress || state.stage == CloudMusicSubmissionStage.UPLOADING
        val isSubmitSelected = state.section == CloudMusicSubmissionSection.SUBMIT
        updateHeaderTabState(
            tab = binding.submissionSubmitTab,
            underline = binding.submissionSubmitTabUnderline,
            container = binding.submissionSubmitTabContainer,
            isSelected = isSubmitSelected,
            isEnabled = !busy,
        )
        updateHeaderTabState(
            tab = binding.submissionHistoryTab,
            underline = binding.submissionHistoryTabUnderline,
            container = binding.submissionHistoryTabContainer,
            isSelected = !isSubmitSelected,
            isEnabled = !busy,
        )

        val visibleState = when {
            !state.loggedIn -> binding.submissionLoginState
            state.editorMode == CloudMusicSubmissionEditorMode.RESUBMISSION &&
                state.stage == CloudMusicSubmissionStage.EDIT_METADATA -> binding.submissionEditorState
            state.section == CloudMusicSubmissionSection.HISTORY -> binding.submissionHistoryState
            state.stage == CloudMusicSubmissionStage.SELECT_FILES -> binding.submissionSelectFilesState
            state.stage == CloudMusicSubmissionStage.UPLOADING -> binding.submissionUploadingState
            state.stage == CloudMusicSubmissionStage.EDIT_METADATA -> binding.submissionEditorState
            else -> binding.submissionSuccessState
        }
        showOnly(visibleState)

        renderFileSelection(state, busy)
        renderUpload(state)
        renderEditor(state, busy)
        renderHistory(state)
    }

    private fun renderHistory(state: CloudMusicSubmissionUiState) {
        historyAdapter.submitList(state.historyItems)

        val hasItems = state.historyItems.isNotEmpty()
        val firstPageLoading = state.historyLoading && !hasItems
        val firstPageError = !hasItems && !state.historyLoading && state.historyError != null
        val empty = !hasItems && !state.historyLoading && state.historyError == null

        binding.submissionHistorySwipeRefresh.isEnabled = hasItems && !state.operationInProgress
        binding.submissionHistorySwipeRefresh.isRefreshing = state.historyLoading && hasItems
        binding.submissionHistoryRecyclerView.isVisible = hasItems

        binding.submissionHistoryFullState.isVisible = !hasItems
        binding.submissionHistoryLoadingIndicator.isVisible = firstPageLoading
        binding.submissionHistoryStateText.isVisible = !firstPageLoading
        binding.submissionHistoryStateText.text = when {
            firstPageError -> state.historyError
            empty -> getString(R.string.cloud_music_submission_history_empty)
            else -> null
        }
        binding.submissionHistoryRetryButton.isVisible = firstPageError
        binding.submissionHistoryEmptyAction.isVisible = empty

        val footerError = state.historyLoadMoreError ?: state.historyRefreshError
        val showFooter = hasItems && (state.historyLoadingMore || footerError != null)
        binding.submissionHistoryFooter.isVisible = showFooter
        binding.submissionHistoryFooterProgress.isVisible = state.historyLoadingMore
        binding.submissionHistoryFooterText.text = when {
            state.historyLoadingMore -> getString(R.string.cloud_music_submission_history_loading_more)
            else -> footerError
        }
        binding.submissionHistoryFooterRetryButton.isVisible = footerError != null
    }

    private fun renderFileSelection(state: CloudMusicSubmissionUiState, busy: Boolean) {
        val audio = state.audio
        val hasAudio = audio != null
        binding.submissionAudioPickBox.isVisible = !hasAudio
        binding.submissionAudioPreviewBox.isVisible = hasAudio
        binding.submissionAudioPickBox.isEnabled = !busy && !state.audioResolving
        binding.submissionAudioPreviewBox.isEnabled = !busy && !state.audioResolving
        binding.submissionAudioDeleteButton.isEnabled = !busy && !state.audioResolving

        if (hasAudio) {
            binding.submissionAudioNameText.text = audio?.displayName
            binding.submissionAudioMetaText.text = listOf(
                audio?.mimeType.orEmpty(),
                Formatter.formatShortFileSize(this, audio?.size ?: 0L),
            ).filter { it.isNotBlank() }.joinToString(" · ")
        }

        val cover = state.cover
        val hasCover = cover != null
        binding.submissionCoverPickBox.isVisible = !hasCover
        binding.submissionCoverPreviewBox.isVisible = hasCover
        binding.submissionCoverPickBox.isEnabled = !busy && !state.coverResolving
        binding.submissionCoverPreviewBox.isEnabled = !busy && !state.coverResolving
        binding.submissionCoverDeleteButton.isEnabled = !busy && !state.coverResolving

        if (hasCover) {
            binding.submissionCoverImageView.load(cover?.uri) {
                crossfade(true)
                placeholder(R.drawable.bg_cloud_music_entry_card)
                error(R.drawable.bg_cloud_music_entry_card)
            }
        } else {
            binding.submissionCoverImageView.setImageDrawable(null)
        }

        val lyrics = state.lyrics
        val hasLyrics = lyrics != null
        binding.submissionLyricsPickBox.isVisible = !hasLyrics
        binding.submissionLyricsPreviewBox.isVisible = hasLyrics
        binding.submissionLyricsPickBox.isEnabled = !busy && !state.lyricsResolving
        binding.submissionLyricsPreviewBox.isEnabled = !busy && !state.lyricsResolving
        binding.submissionLyricsDeleteButton.isEnabled = !busy && !state.lyricsResolving

        if (hasLyrics) {
            binding.submissionLyricsNameText.text = lyrics?.displayName
            binding.submissionLyricsMetaText.text = listOf(
                lyrics?.mimeType.orEmpty(),
                Formatter.formatShortFileSize(this, lyrics?.size ?: 0L),
            ).filter { it.isNotBlank() }.joinToString(" · ")
        }

        binding.submissionUploadExtractButton.isEnabled =
            audio != null && !busy && !state.hasResolvingFile()
    }

    private fun renderUpload(state: CloudMusicSubmissionUiState) {
        binding.submissionUploadPhaseText.setText(phaseLabel(state.uploadPhase))
        binding.submissionUploadFileNameText.text = state.audio?.displayName.orEmpty()
        binding.submissionUploadProgress.setProgressCompat(state.uploadPercent.coerceIn(0, 100), true)
        binding.submissionUploadPercentText.text = getString(
            R.string.cloud_music_submission_percent,
            state.uploadPercent.coerceIn(0, 100),
        )
    }

    private fun renderEditor(state: CloudMusicSubmissionUiState, busy: Boolean) {
        val track = state.editingTrack ?: return
        val editorKey = "${state.editorMode}:${track.uuid}:${state.editorRevision}"
        if (boundEditorKey != editorKey) {
            boundEditorKey = editorKey
            editorBinding.editorTitleEditText.setText(track.title)
            editorBinding.editorArtistEditText.setText(track.artist)
            editorBinding.editorAlbumEditText.setText(track.album.orEmpty())
            editorBinding.editorDurationEditText.setText(formatDuration(track.durationMs))
            clearEditorErrors()
        }

        val coverModel: Any = state.cover?.uri
            ?: track.cover?.url?.takeIf(String::isNotBlank)
            ?: R.drawable.ic_pm_icon
        if (editorBinding.editorCoverPreview.tag != coverModel) {
            editorBinding.editorCoverPreview.tag = coverModel
            editorBinding.editorCoverPreview.load(coverModel) {
                crossfade(true)
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
        }
        editorBinding.editorCoverFileText.text = when {
            state.coverResolving -> getString(R.string.cloud_music_submission_resolving_cover)
            state.cover != null -> formatSelectedFile(state.cover)
            else -> getString(R.string.cloud_music_submission_current_cover)
        }

        val selectedLyrics = state.lyrics
        val existingLyrics = track.lyrics
        editorBinding.editorLyricsStatusText.text = when {
            state.lyricsResolving -> getString(R.string.cloud_music_submission_resolving_lyrics)
            selectedLyrics != null -> getString(
                R.string.cloud_music_submission_lyrics_selected,
                selectedLyrics.displayName,
            )
            existingLyrics != null -> getString(
                R.string.cloud_music_submission_lyrics_existing,
                existingLyrics.fileName ?: existingLyrics.format ?: getString(
                    R.string.cloud_music_submission_lyrics_title,
                ),
            )
            else -> getString(R.string.cloud_music_submission_no_lyrics)
        }
        editorBinding.editorSelectLyricsButton.setText(
            if (selectedLyrics != null || existingLyrics != null) {
                R.string.cloud_music_submission_replace_lyrics
            } else {
                R.string.cloud_music_submission_add_lyrics
            },
        )
        editorBinding.editorClearLyricsButton.isVisible = selectedLyrics != null

        val hasUploadedCover = track.cover?.source.equals("uploaded", ignoreCase = true)
        editorBinding.editorRemoveCoverButton.isVisible =
            state.editorMode == CloudMusicSubmissionEditorMode.NEW_SUBMISSION &&
                (state.cover != null || hasUploadedCover)
        editorBinding.editorModeTitleText.setText(
            if (state.editorMode == CloudMusicSubmissionEditorMode.RESUBMISSION) {
                R.string.cloud_music_submission_resubmission_editor_title
            } else {
                R.string.cloud_music_submission_editor_title
            },
        )
        editorBinding.editorSubmitButton.setText(
            if (state.editorMode == CloudMusicSubmissionEditorMode.RESUBMISSION) {
                R.string.cloud_music_submission_resubmit_review
            } else {
                R.string.cloud_music_submission_submit_review
            },
        )

        editorBinding.editorSelectCoverButton.isEnabled = !busy && !state.coverResolving
        editorBinding.editorRemoveCoverButton.isEnabled = !busy && !state.coverResolving
        editorBinding.editorSelectLyricsButton.isEnabled = !busy && !state.lyricsResolving
        editorBinding.editorClearLyricsButton.isEnabled = !busy && !state.lyricsResolving
        editorBinding.editorTitleEditText.isEnabled = !busy
        editorBinding.editorArtistEditText.isEnabled = !busy
        editorBinding.editorAlbumEditText.isEnabled = !busy
        editorBinding.editorDurationEditText.isEnabled = !busy
        editorBinding.editorSubmitButton.isEnabled =
            !busy && !state.coverResolving && !state.lyricsResolving
        editorBinding.editorOperationProgressContainer.isVisible = busy
        editorBinding.editorOperationText.setText(phaseLabel(state.uploadPhase))
        editorBinding.editorOperationProgress.setProgressCompat(
            state.uploadPercent.coerceIn(0, 100),
            true,
        )
    }

    private fun submitEditor() {
        val title = editorBinding.editorTitleEditText.text?.toString()?.trim().orEmpty()
        val artist = editorBinding.editorArtistEditText.text?.toString()?.trim().orEmpty()
        val album = editorBinding.editorAlbumEditText.text?.toString()?.trim().orEmpty()
        val durationMs = parseDuration(editorBinding.editorDurationEditText.text?.toString().orEmpty())

        var valid = true
        editorBinding.editorTitleLayout.error = when {
            title.isEmpty() -> getString(R.string.cloud_music_submission_title_required)
            title.length > MAX_TITLE_LENGTH -> getString(R.string.cloud_music_submission_title_too_long)
            else -> null
        }.also { if (it != null) valid = false }
        editorBinding.editorArtistLayout.error = when {
            artist.isEmpty() -> getString(R.string.cloud_music_submission_artist_required)
            artist.length > MAX_ARTIST_LENGTH -> getString(R.string.cloud_music_submission_artist_too_long)
            else -> null
        }.also { if (it != null) valid = false }
        editorBinding.editorAlbumLayout.error = if (album.length > MAX_ALBUM_LENGTH) {
            getString(R.string.cloud_music_submission_album_too_long).also { valid = false }
        } else {
            null
        }
        editorBinding.editorDurationLayout.error = if (durationMs == null) {
            getString(R.string.cloud_music_submission_duration_invalid).also { valid = false }
        } else {
            null
        }
        if (!valid || durationMs == null) return

        viewModel.submitMetadata(
            CloudMusicSubmissionInput(
                title = title,
                artist = artist,
                album = album,
                durationMs = durationMs,
            ),
        )
    }

    private fun parseDuration(raw: String): Long? {
        val match = DURATION_PATTERN.matchEntire(raw.trim()) ?: return null
        val minutes = match.groupValues[1].toLongOrNull() ?: return null
        val seconds = match.groupValues[2].toLongOrNull() ?: return null
        if (minutes > MAX_DURATION_MINUTES) return null
        val durationMs = (minutes * 60L + seconds) * 1_000L
        return durationMs.takeIf { it in 1L..MAX_DURATION_MS }
    }

    private fun formatDuration(durationMs: Long): String {
        val totalSeconds = durationMs.coerceAtLeast(0L) / 1_000L
        return String.format(Locale.ROOT, "%02d:%02d", totalSeconds / 60L, totalSeconds % 60L)
    }

    private fun clearEditorErrors() {
        editorBinding.editorTitleLayout.error = null
        editorBinding.editorArtistLayout.error = null
        editorBinding.editorAlbumLayout.error = null
        editorBinding.editorDurationLayout.error = null
    }

    private fun formatSelectedFile(file: CloudMusicSubmissionFile): String =
        "${file.displayName} · ${Formatter.formatShortFileSize(this, file.size)}"

    private fun CloudMusicSubmissionUiState.hasResolvingFile(): Boolean =
        audioResolving || coverResolving || lyricsResolving

    private fun phaseLabel(phase: CloudMusicUploadPhase?): Int = when (phase) {
        CloudMusicUploadPhase.AUDIO -> R.string.cloud_music_submission_uploading_audio
        CloudMusicUploadPhase.COVER -> R.string.cloud_music_submission_uploading_cover
        CloudMusicUploadPhase.LYRICS -> R.string.cloud_music_submission_uploading_lyrics
        CloudMusicUploadPhase.PROCESSING -> R.string.cloud_music_submission_processing
        null -> R.string.cloud_music_submission_submitting
    }

    private fun showOnly(visibleState: View) {
        listOf(
            binding.submissionLoginState,
            binding.submissionSelectFilesState,
            binding.submissionUploadingState,
            binding.submissionEditorState,
            binding.submissionSuccessState,
            binding.submissionHistoryState,
        ).forEach { it.isVisible = it === visibleState }
    }

    private fun openAudioPicker() {
        audioPicker.launch(arrayOf("audio/*"))
    }

    private fun openCoverPicker() {
        coverPicker.launch(arrayOf("image/*"))
    }

    private fun openLyricsPicker() {
        lyricsPicker.launch(arrayOf("text/plain", "text/*", "application/octet-stream"))
    }

    private fun updateHeaderTabState(
        tab: TextView,
        underline: View,
        container: View,
        isSelected: Boolean,
        isEnabled: Boolean,
    ) {
        val selectedColor = ContextCompat.getColor(this, R.color.home_tab_selected)
        val unselectedColor = ContextCompat.getColor(this, R.color.home_tab_unselected)
        tab.setTextColor(if (isSelected) selectedColor else unselectedColor)
        tab.alpha = if (isEnabled) 1f else 0.5f
        underline.visibility = if (isSelected) View.VISIBLE else View.INVISIBLE
        underline.setBackgroundColor(selectedColor)
        underline.alpha = if (isEnabled) 1f else 0.5f
        container.isEnabled = isEnabled
    }

    private fun showCoverPreviewDialog(coverUri: Uri? = null, coverUrl: String? = null) {
        val dialog = android.app.Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
        val dialogBinding = DialogImagePreviewBinding.inflate(layoutInflater)
        dialog.setContentView(dialogBinding.root)

        if (coverUri != null) {
            dialogBinding.dialogPreviewImageView.load(coverUri) {
                crossfade(true)
                placeholder(R.drawable.bg_cloud_music_entry_card)
                error(R.drawable.bg_cloud_music_entry_card)
            }
        } else if (!coverUrl.isNullOrBlank()) {
            dialogBinding.dialogPreviewImageView.load(coverUrl) {
                crossfade(true)
                placeholder(R.drawable.bg_cloud_music_entry_card)
                error(R.drawable.bg_cloud_music_entry_card)
            }
        }

        dialogBinding.dialogPreviewCloseButton.setOnClickListener { dialog.dismiss() }
        dialogBinding.dialogImagePreviewRoot.setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    private fun setupSystemBars() {
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.cloudMusicSubmissionRoot.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.cloudMusicSubmissionContent.updatePadding(bottom = insets.bottom)
        }
    }

    companion object {
        const val EXTRA_INITIAL_SECTION = "extra_initial_section"
        private const val MAX_TITLE_LENGTH = 200
        private const val MAX_ARTIST_LENGTH = 300
        private const val MAX_ALBUM_LENGTH = 200
        private const val MAX_DURATION_MINUTES = 1_440L
        private const val MAX_DURATION_MS = 86_400_000L
        private val DURATION_PATTERN = Regex("^(\\d{1,4}):([0-5]\\d)$")

        fun createIntent(
            context: Context,
            initialSection: CloudMusicSubmissionSection = CloudMusicSubmissionSection.SUBMIT,
        ): Intent = Intent(context, CloudMusicSubmissionActivity::class.java).apply {
            putExtra(EXTRA_INITIAL_SECTION, initialSection.name)
        }

        fun start(
            context: Context,
            initialSection: CloudMusicSubmissionSection = CloudMusicSubmissionSection.SUBMIT,
        ) {
            context.startActivity(createIntent(context, initialSection))
            AppActivityTransitions.applyForward(context)
        }
    }
}
