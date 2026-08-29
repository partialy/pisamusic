package cn.partialy.pm.ui.cloudmusic.submission

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionException
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionFile
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionFileKind
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionInput
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionRepository
import cn.partialy.pm.network.cloudmusic.CloudMusicTrackDto
import cn.partialy.pm.network.cloudmusic.CloudMusicUploadPhase
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class CloudMusicSubmissionViewModel @Inject constructor(
    private val repository: CloudMusicSubmissionRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(CloudMusicSubmissionUiState())
    val state: StateFlow<CloudMusicSubmissionUiState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<CloudMusicSubmissionEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<CloudMusicSubmissionEvent> = _events.asSharedFlow()

    @Volatile
    private var activeUserId: String? = null

    @Volatile
    private var accountGeneration = 0L

    @Volatile
    private var operationGeneration = 0L

    private var operationJob: Job? = null
    private var historyJob: Job? = null
    private var historyLoadMoreJob: Job? = null
    private var audioResolveJob: Job? = null
    private var coverResolveJob: Job? = null
    private var lyricsResolveJob: Job? = null
    private var historyGeneration = 0L
    private var audioResolveGeneration = 0L
    private var coverResolveGeneration = 0L
    private var lyricsResolveGeneration = 0L
    private var editorRevisionGeneration = 0L
    private var historyRequested = false

    private var uploadedCoverFile: CloudMusicSubmissionFile? = null
    private var uploadedLyricsFile: CloudMusicSubmissionFile? = null
    private var newSubmissionDraft: NewSubmissionDraft? = null

    init {
        refreshLoginState()
    }

    /** Activity 在 onResume 调用；账号身份变化时清空全部投稿上下文。 */
    fun refreshLoginState() {
        synchronizeAccount()
    }

    fun selectSection(section: CloudMusicSubmissionSection) {
        if (guardOperation()) return
        applySection(section)
        if (section == CloudMusicSubmissionSection.HISTORY && _state.value.loggedIn && !historyRequested) {
            loadHistoryFirstPage()
        }
    }

    /** 成功态只发送一个意图：切换历史并强制刷新最新第一页。 */
    fun openLatestHistory() {
        if (guardOperation()) return
        applySection(CloudMusicSubmissionSection.HISTORY)
        if (_state.value.loggedIn) loadHistoryFirstPage()
    }

    private fun applySection(section: CloudMusicSubmissionSection) {
        if (_state.value.editorMode == CloudMusicSubmissionEditorMode.RESUBMISSION) {
            exitResubmission(section)
        } else {
            _state.update { it.copy(section = section) }
        }
    }

    /** 这三个方法只变更页面选择状态，不触发上传。 */
    fun selectAudio(file: CloudMusicSubmissionFile?) {
        val snapshot = _state.value
        if (snapshot.operationInProgress ||
            snapshot.editorMode != CloudMusicSubmissionEditorMode.NEW_SUBMISSION ||
            snapshot.stage != CloudMusicSubmissionStage.SELECT_FILES ||
            file?.kind?.let { it != CloudMusicSubmissionFileKind.AUDIO } == true
        ) {
            return
        }
        invalidateFileResolution(CloudMusicSubmissionFileKind.AUDIO)
        _state.update { it.copy(audio = file, audioResolving = false) }
    }

    fun selectCover(file: CloudMusicSubmissionFile?) {
        val snapshot = _state.value
        if (snapshot.operationInProgress ||
            snapshot.stage !in EDITABLE_FILE_STAGES ||
            file?.kind?.let { it != CloudMusicSubmissionFileKind.COVER } == true
        ) {
            return
        }
        invalidateFileResolution(CloudMusicSubmissionFileKind.COVER)
        _state.update { it.copy(cover = file, coverResolving = false) }
    }

    fun selectLyrics(file: CloudMusicSubmissionFile?) {
        val snapshot = _state.value
        if (snapshot.operationInProgress ||
            snapshot.stage !in EDITABLE_FILE_STAGES ||
            file?.kind?.let { it != CloudMusicSubmissionFileKind.LYRICS } == true
        ) {
            return
        }
        invalidateFileResolution(CloudMusicSubmissionFileKind.LYRICS)
        _state.update { it.copy(lyrics = file, lyricsResolving = false) }
    }

    /** 文件选择器只交付 Uri；同类型新选择会使旧解析结果失效。 */
    fun resolveAndSelectFile(uri: Uri, kind: CloudMusicSubmissionFileKind) {
        synchronizeAccount()
        if (!canResolveFile(kind, _state.value)) return
        fileResolutionJob(kind)?.cancel()
        val token = nextFileResolution(kind)
        setFileResolving(kind, true)
        val job = viewModelScope.launch {
            try {
                val file = repository.resolveFile(uri, kind)
                synchronizeAccount()
                if (!isCurrent(token)) return@launch
                completeFileResolution(token, file)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                synchronizeAccount()
                if (isCurrent(token)) {
                    finishFileResolution(token)
                    handleFailure(error, "无法读取所选文件")
                }
            }
        }
        setFileResolutionJob(kind, job)
    }

    fun uploadAndExtract() {
        if (guardOperation()) return
        val snapshot = _state.value
        val snapshotUserId = activeUserId
        val audio = snapshot.audio
        if (!snapshot.loggedIn) {
            emitMessage(LOGIN_REQUIRED_MESSAGE)
            return
        }
        if (snapshot.editorMode != CloudMusicSubmissionEditorMode.NEW_SUBMISSION ||
            snapshot.stage != CloudMusicSubmissionStage.SELECT_FILES
        ) {
            return
        }
        if (snapshot.hasResolvingFile()) {
            emitMessage(FILE_RESOLUTION_IN_PROGRESS_MESSAGE)
            return
        }
        if (audio == null) {
            emitMessage("请先选择音频文件")
            return
        }
        val token = nextOperation(snapshotUserId) ?: run {
            if (!_state.value.loggedIn) emitMessage(LOGIN_REQUIRED_MESSAGE)
            return
        }

        _state.update {
            it.copy(
                stage = CloudMusicSubmissionStage.UPLOADING,
                uploadPhase = CloudMusicUploadPhase.AUDIO,
                uploadPercent = 0,
                operationInProgress = true,
            )
        }
        operationJob = viewModelScope.launch {
            try {
                ensureCurrent(token)
                val track = repository.createAndUploadSubmission(
                    audio = audio,
                    cover = snapshot.cover,
                    lyrics = snapshot.lyrics,
                    onProgress = { phase, percent -> updateUploadProgress(token, phase, percent) },
                )
                ensureCurrent(token)
                uploadedCoverFile = snapshot.cover
                uploadedLyricsFile = snapshot.lyrics
                _state.update {
                    it.copy(
                        stage = CloudMusicSubmissionStage.EDIT_METADATA,
                        editingTrack = track,
                        editorRevision = ++editorRevisionGeneration,
                        uploadPhase = null,
                        uploadPercent = 100,
                        operationInProgress = false,
                    )
                }
            } catch (error: CancellationException) {
                synchronizeAccount()
                recoverCancelledOperation(token, CloudMusicSubmissionStage.SELECT_FILES)
                throw error
            } catch (error: Throwable) {
                synchronizeAccount()
                if (isCurrent(token)) {
                    _state.update {
                        it.copy(
                            stage = CloudMusicSubmissionStage.SELECT_FILES,
                            uploadPhase = null,
                            uploadPercent = 0,
                            operationInProgress = false,
                        )
                    }
                    handleFailure(error, "上传并解析歌曲失败")
                }
            }
        }
    }

    fun submitMetadata(input: CloudMusicSubmissionInput) {
        if (guardOperation()) return
        val snapshot = _state.value
        val snapshotUserId = activeUserId
        val track = snapshot.editingTrack ?: run {
            emitMessage("投稿曲目信息不存在，请重新上传")
            return
        }
        if (!snapshot.loggedIn) {
            emitMessage(LOGIN_REQUIRED_MESSAGE)
            return
        }
        if (snapshot.stage != CloudMusicSubmissionStage.EDIT_METADATA) return
        if (snapshot.coverResolving || snapshot.lyricsResolving) {
            emitMessage(FILE_RESOLUTION_IN_PROGRESS_MESSAGE)
            return
        }
        val token = nextOperation(snapshotUserId) ?: run {
            if (!_state.value.loggedIn) emitMessage(LOGIN_REQUIRED_MESSAGE)
            return
        }

        _state.update {
            it.copy(
                operationInProgress = true,
                uploadPhase = null,
                uploadPercent = 0,
            )
        }
        operationJob = viewModelScope.launch {
            try {
                ensureCurrent(token)
                val trackWithAttachments = uploadPendingAttachments(token, track)
                updateUploadProgress(token, CloudMusicUploadPhase.PROCESSING, 100)
                val savedTrack = when (snapshot.editorMode) {
                    CloudMusicSubmissionEditorMode.NEW_SUBMISSION ->
                        repository.save(trackWithAttachments.uuid, input)

                    CloudMusicSubmissionEditorMode.RESUBMISSION ->
                        repository.resubmit(trackWithAttachments.uuid, input)
                }
                ensureCurrent(token)
                if (snapshot.editorMode == CloudMusicSubmissionEditorMode.RESUBMISSION) {
                    finishResubmission(token, savedTrack)
                } else {
                    _state.update {
                        it.copy(
                            stage = CloudMusicSubmissionStage.SUCCESS,
                            editingTrack = savedTrack,
                            uploadPhase = null,
                            uploadPercent = 100,
                            operationInProgress = false,
                        )
                    }
                }
                if (isCurrent(token)) _events.tryEmit(CloudMusicSubmissionEvent.SubmissionChanged)
            } catch (error: CancellationException) {
                synchronizeAccount()
                recoverCancelledOperation(token, CloudMusicSubmissionStage.EDIT_METADATA)
                throw error
            } catch (error: Throwable) {
                synchronizeAccount()
                if (isCurrent(token)) {
                    _state.update {
                        it.copy(
                            uploadPhase = null,
                            operationInProgress = false,
                        )
                    }
                    handleFailure(error, "提交投稿信息失败")
                }
            }
        }
    }

    fun removeCover() {
        if (guardOperation()) return
        val snapshot = _state.value
        val snapshotUserId = activeUserId
        val track = snapshot.editingTrack ?: return
        if (!snapshot.loggedIn ||
            snapshot.editorMode != CloudMusicSubmissionEditorMode.NEW_SUBMISSION ||
            snapshot.stage != CloudMusicSubmissionStage.EDIT_METADATA
        ) {
            return
        }
        if (snapshot.coverResolving) {
            emitMessage(FILE_RESOLUTION_IN_PROGRESS_MESSAGE)
            return
        }
        val token = nextOperation(snapshotUserId) ?: return

        _state.update { it.copy(operationInProgress = true) }
        operationJob = viewModelScope.launch {
            try {
                ensureCurrent(token)
                val updatedTrack = repository.removeCover(track.uuid)
                ensureCurrent(token)
                uploadedCoverFile = null
                _state.update {
                    it.copy(
                        cover = null,
                        editingTrack = updatedTrack,
                        operationInProgress = false,
                    )
                }
            } catch (error: CancellationException) {
                synchronizeAccount()
                recoverCancelledOperation(token, CloudMusicSubmissionStage.EDIT_METADATA)
                throw error
            } catch (error: Throwable) {
                synchronizeAccount()
                if (isCurrent(token)) {
                    _state.update { it.copy(operationInProgress = false) }
                    handleFailure(error, "移除投稿封面失败")
                }
            }
        }
    }

    fun startNewSubmission() {
        if (guardOperation()) return
        invalidateAllFileResolutions()
        newSubmissionDraft = null
        uploadedCoverFile = null
        uploadedLyricsFile = null
        _state.update {
            it.copy(
                section = CloudMusicSubmissionSection.SUBMIT,
                stage = CloudMusicSubmissionStage.SELECT_FILES,
                editorMode = CloudMusicSubmissionEditorMode.NEW_SUBMISSION,
                audio = null,
                cover = null,
                lyrics = null,
                audioResolving = false,
                coverResolving = false,
                lyricsResolving = false,
                editingTrack = null,
                uploadPhase = null,
                uploadPercent = 0,
                operationInProgress = false,
            )
        }
    }

    fun openResubmission(track: CloudMusicTrackDto) {
        if (guardOperation()) return
        val userId = activeUserId
        if (!_state.value.loggedIn) {
            emitMessage(LOGIN_REQUIRED_MESSAGE)
            return
        }
        val status = track.status?.lowercase(Locale.ROOT)
        if (status == null || status !in RESUBMITTABLE_STATUSES) {
            emitMessage("当前投稿状态不允许重新提审")
            return
        }
        if (userId == null || synchronizeAccount() != userId) return
        invalidateAllFileResolutions()
        if (_state.value.editorMode != CloudMusicSubmissionEditorMode.RESUBMISSION) {
            newSubmissionDraft = NewSubmissionDraft.from(_state.value, uploadedCoverFile, uploadedLyricsFile)
        }
        uploadedCoverFile = null
        uploadedLyricsFile = null
        _state.update {
            it.copy(
                section = CloudMusicSubmissionSection.HISTORY,
                stage = CloudMusicSubmissionStage.EDIT_METADATA,
                editorMode = CloudMusicSubmissionEditorMode.RESUBMISSION,
                audio = null,
                cover = null,
                lyrics = null,
                audioResolving = false,
                coverResolving = false,
                lyricsResolving = false,
                editingTrack = track,
                editorRevision = ++editorRevisionGeneration,
                uploadPhase = null,
                uploadPercent = 0,
                operationInProgress = false,
            )
        }
    }

    fun refreshHistory() {
        if (!_state.value.loggedIn) return
        loadHistoryFirstPage()
    }

    fun retryHistoryFirstPage() = refreshHistory()

    fun retryHistoryLoadMore() = loadMoreHistory()

    /** RecyclerView 绑定接近尾部的 item 时调用，避免 Activity 自己计算分页 offset。 */
    fun onHistoryItemVisible(position: Int) {
        val size = _state.value.historyItems.size
        if (size > 0 && position >= (size - HISTORY_PREFETCH_DISTANCE).coerceAtLeast(0)) {
            loadMoreHistory()
        }
    }

    fun loadMoreHistory() {
        synchronizeAccount()
        val snapshot = _state.value
        if (!snapshot.loggedIn ||
            snapshot.historyLoading ||
            snapshot.historyLoadingMore ||
            snapshot.historyItems.isEmpty() ||
            !snapshot.historyHasMore ||
            historyLoadMoreJob?.isActive == true
        ) {
            return
        }

        val userId = activeUserId ?: return
        val token = HistoryRequestToken(historyGeneration, accountGeneration, userId)
        val offset = snapshot.historyNextOffset
        _state.update {
            it.copy(
                historyLoadingMore = true,
                historyLoadMoreError = null,
            )
        }
        historyLoadMoreJob = viewModelScope.launch {
            try {
                synchronizeAccount()
                if (!isCurrent(token)) return@launch
                val page = repository.getHistory(offset, PAGE_SIZE)
                synchronizeAccount()
                if (!isCurrent(token)) return@launch
                val current = _state.value
                val nextOffset = (page.offset + page.items.size).coerceAtLeast(offset)
                _state.update {
                    it.copy(
                        historyItems = (current.historyItems + page.items).distinctBy { item -> item.uuid },
                        historyTotal = page.total,
                        historyLoadingMore = false,
                        historyLoadMoreError = null,
                        historyNextOffset = nextOffset,
                        historyHasMore = page.items.isNotEmpty() && nextOffset < page.total,
                    )
                }
            } catch (error: Throwable) {
                if (error is CancellationException) throw error
                synchronizeAccount()
                if (!isCurrent(token)) return@launch
                if (error is CloudMusicSubmissionException.LoginRequired) {
                    markLoginRequired()
                } else {
                    _state.update {
                        it.copy(
                            historyLoadingMore = false,
                            historyLoadMoreError = error.messageOr("加载更多投稿记录失败"),
                        )
                    }
                }
            }
        }
    }

    /** Activity 只需响应 CloseRequested 真正关闭，其他返回分支均由状态机消费。 */
    fun handleBack() {
        synchronizeAccount()
        val snapshot = _state.value
        when {
            snapshot.operationInProgress || snapshot.stage == CloudMusicSubmissionStage.UPLOADING ->
                emitMessage(OPERATION_IN_PROGRESS_MESSAGE)

            snapshot.editorMode == CloudMusicSubmissionEditorMode.RESUBMISSION ->
                exitResubmission(CloudMusicSubmissionSection.HISTORY)

            snapshot.editorMode == CloudMusicSubmissionEditorMode.NEW_SUBMISSION &&
                snapshot.stage == CloudMusicSubmissionStage.EDIT_METADATA ->
                _state.update {
                    it.copy(
                        section = CloudMusicSubmissionSection.SUBMIT,
                        stage = CloudMusicSubmissionStage.SELECT_FILES,
                        editingTrack = null,
                        uploadPhase = null,
                        uploadPercent = 0,
                    )
                }

            else -> _events.tryEmit(CloudMusicSubmissionEvent.CloseRequested)
        }
    }

    private fun loadHistoryFirstPage() {
        val userId = synchronizeAccount() ?: return
        historyRequested = true
        historyJob?.cancel()
        historyLoadMoreJob?.cancel()
        val token = HistoryRequestToken(++historyGeneration, accountGeneration, userId)
        val hadItems = _state.value.historyItems.isNotEmpty()
        _state.update {
            it.copy(
                historyLoading = true,
                historyLoadingMore = false,
                historyError = null,
                historyRefreshError = null,
                historyLoadMoreError = null,
            )
        }
        historyJob = viewModelScope.launch {
            try {
                synchronizeAccount()
                if (!isCurrent(token)) return@launch
                val page = repository.getHistory(0, PAGE_SIZE)
                synchronizeAccount()
                if (!isCurrent(token)) return@launch
                val nextOffset = page.offset + page.items.size
                _state.update {
                    it.copy(
                        historyItems = page.items.distinctBy { item -> item.uuid },
                        historyTotal = page.total,
                        historyLoading = false,
                        historyError = null,
                        historyRefreshError = null,
                        historyNextOffset = nextOffset,
                        historyHasMore = page.items.isNotEmpty() && nextOffset < page.total,
                    )
                }
            } catch (error: Throwable) {
                if (error is CancellationException) throw error
                synchronizeAccount()
                if (!isCurrent(token)) return@launch
                if (error is CloudMusicSubmissionException.LoginRequired) {
                    markLoginRequired()
                } else {
                    val message = error.messageOr("加载投稿记录失败")
                    _state.update {
                        if (hadItems) {
                            it.copy(historyLoading = false, historyRefreshError = message)
                        } else {
                            it.copy(historyLoading = false, historyError = message)
                        }
                    }
                }
            }
        }
    }

    private suspend fun uploadPendingAttachments(
        token: OperationToken,
        initialTrack: CloudMusicTrackDto,
    ): CloudMusicTrackDto {
        ensureCurrent(token)
        var track = initialTrack
        val selectedCover = _state.value.cover
        if (selectedCover != null && selectedCover != uploadedCoverFile) {
            track = repository.replaceCover(track.uuid, selectedCover) { percent ->
                updateUploadProgress(token, CloudMusicUploadPhase.COVER, percent)
            }
            ensureCurrent(token)
            uploadedCoverFile = selectedCover
            _state.update { it.copy(editingTrack = track) }
        }

        ensureCurrent(token)
        val selectedLyrics = _state.value.lyrics
        if (selectedLyrics != null && selectedLyrics != uploadedLyricsFile) {
            track = repository.replaceLyrics(track.uuid, selectedLyrics) { percent ->
                updateUploadProgress(token, CloudMusicUploadPhase.LYRICS, percent)
            }
            ensureCurrent(token)
            uploadedLyricsFile = selectedLyrics
            _state.update { it.copy(editingTrack = track) }
        }
        return track
    }

    private fun finishResubmission(token: OperationToken, savedTrack: CloudMusicTrackDto) {
        if (!isCurrent(token)) return
        val draft = newSubmissionDraft
        restoreNewSubmissionDraft(draft, CloudMusicSubmissionSection.HISTORY)
        _state.update { current ->
            current.copy(
                historyItems = current.historyItems.map { item ->
                    if (item.uuid == savedTrack.uuid) savedTrack else item
                },
                operationInProgress = false,
            )
        }
        refreshHistory()
    }

    private fun exitResubmission(section: CloudMusicSubmissionSection) {
        restoreNewSubmissionDraft(newSubmissionDraft, section)
    }

    private fun restoreNewSubmissionDraft(
        draft: NewSubmissionDraft?,
        section: CloudMusicSubmissionSection,
    ) {
        // 所有退出重审的路径都先失效当前附件解析，禁止迟到结果污染恢复后的首次投稿草稿。
        invalidateAllFileResolutions()
        uploadedCoverFile = draft?.uploadedCoverFile
        uploadedLyricsFile = draft?.uploadedLyricsFile
        newSubmissionDraft = null
        _state.update {
            it.copy(
                section = section,
                stage = draft?.stage ?: CloudMusicSubmissionStage.SELECT_FILES,
                editorMode = CloudMusicSubmissionEditorMode.NEW_SUBMISSION,
                audio = draft?.audio,
                cover = draft?.cover,
                lyrics = draft?.lyrics,
                audioResolving = false,
                coverResolving = false,
                lyricsResolving = false,
                editingTrack = draft?.editingTrack,
                editorRevision = draft?.editorRevision ?: it.editorRevision,
                uploadPhase = null,
                uploadPercent = draft?.uploadPercent ?: 0,
                operationInProgress = false,
            )
        }
    }

    /** OkHttp 上传线程会直接回调；代际校验后使用原子 update，避免旧账号进度写回。 */
    private fun updateUploadProgress(
        token: OperationToken,
        phase: CloudMusicUploadPhase,
        percent: Int,
    ) {
        if (!isCurrent(token)) return
        _state.update {
            if (!isCurrent(token) || !it.operationInProgress) it else it.copy(
                uploadPhase = phase,
                uploadPercent = percent.coerceIn(0, 100),
            )
        }
    }

    private fun guardOperation(): Boolean {
        val beforeUserId = activeUserId
        synchronizeAccount()
        if (beforeUserId != activeUserId) return true
        if (!_state.value.operationInProgress) return false
        emitMessage(OPERATION_IN_PROGRESS_MESSAGE)
        return true
    }

    private fun handleFailure(error: Throwable, fallback: String) {
        if (error is CloudMusicSubmissionException.LoginRequired) refreshLoginState()
        emitMessage(error.messageOr(fallback))
    }

    private fun markLoginRequired() {
        refreshLoginState()
    }

    private fun synchronizeAccount(): String? {
        val currentUserId = repository.currentUserId()
        if (currentUserId != activeUserId) {
            resetForAccount(currentUserId)
        } else {
            _state.update { it.copy(loggedIn = currentUserId != null) }
        }
        return currentUserId
    }

    private fun resetForAccount(currentUserId: String?) {
        accountGeneration++
        operationGeneration++
        historyGeneration++
        audioResolveGeneration++
        coverResolveGeneration++
        lyricsResolveGeneration++

        operationJob?.cancel()
        historyJob?.cancel()
        historyLoadMoreJob?.cancel()
        audioResolveJob?.cancel()
        coverResolveJob?.cancel()
        lyricsResolveJob?.cancel()
        operationJob = null
        historyJob = null
        historyLoadMoreJob = null
        audioResolveJob = null
        coverResolveJob = null
        lyricsResolveJob = null

        activeUserId = currentUserId
        historyRequested = false
        uploadedCoverFile = null
        uploadedLyricsFile = null
        newSubmissionDraft = null
        _state.value = CloudMusicSubmissionUiState(loggedIn = currentUserId != null)
    }

    private fun nextOperation(expectedUserId: String?): OperationToken? {
        val userId = synchronizeAccount() ?: return null
        if (userId != expectedUserId) return null
        return OperationToken(
            userId = userId,
            accountGeneration = accountGeneration,
            operationGeneration = ++operationGeneration,
        )
    }

    private fun isCurrent(token: OperationToken): Boolean =
        token.userId == activeUserId &&
            token.accountGeneration == accountGeneration &&
            token.operationGeneration == operationGeneration

    private fun ensureCurrent(token: OperationToken) {
        synchronizeAccount()
        if (!isCurrent(token)) throw CancellationException("投稿操作已失效")
    }

    private fun recoverCancelledOperation(
        token: OperationToken,
        recoveryStage: CloudMusicSubmissionStage,
    ) {
        if (!isCurrent(token)) return
        _state.update {
            it.copy(
                stage = recoveryStage,
                uploadPhase = null,
                uploadPercent = 0,
                operationInProgress = false,
            )
        }
    }

    private fun canResolveFile(
        kind: CloudMusicSubmissionFileKind,
        state: CloudMusicSubmissionUiState,
    ): Boolean {
        if (state.operationInProgress) return false
        return when (kind) {
            CloudMusicSubmissionFileKind.AUDIO ->
                state.editorMode == CloudMusicSubmissionEditorMode.NEW_SUBMISSION &&
                    state.stage == CloudMusicSubmissionStage.SELECT_FILES
            CloudMusicSubmissionFileKind.COVER,
            CloudMusicSubmissionFileKind.LYRICS -> state.stage in EDITABLE_FILE_STAGES
        }
    }

    private fun completeFileResolution(
        token: FileResolutionToken,
        file: CloudMusicSubmissionFile,
    ) {
        if (!isCurrent(token)) return
        _state.update {
            if (!isCurrent(token)) return@update it
            when (token.kind) {
                CloudMusicSubmissionFileKind.AUDIO -> it.copy(audio = file, audioResolving = false)
                CloudMusicSubmissionFileKind.COVER -> it.copy(cover = file, coverResolving = false)
                CloudMusicSubmissionFileKind.LYRICS -> it.copy(lyrics = file, lyricsResolving = false)
            }
        }
        setFileResolutionJob(token.kind, null)
    }

    private fun finishFileResolution(token: FileResolutionToken) {
        if (!isCurrent(token)) return
        setFileResolving(token.kind, false)
        setFileResolutionJob(token.kind, null)
    }

    private fun setFileResolving(kind: CloudMusicSubmissionFileKind, resolving: Boolean) {
        _state.update {
            when (kind) {
                CloudMusicSubmissionFileKind.AUDIO -> it.copy(audioResolving = resolving)
                CloudMusicSubmissionFileKind.COVER -> it.copy(coverResolving = resolving)
                CloudMusicSubmissionFileKind.LYRICS -> it.copy(lyricsResolving = resolving)
            }
        }
    }

    private fun invalidateFileResolution(kind: CloudMusicSubmissionFileKind) {
        fileResolutionJob(kind)?.cancel()
        when (kind) {
            CloudMusicSubmissionFileKind.AUDIO -> audioResolveGeneration++
            CloudMusicSubmissionFileKind.COVER -> coverResolveGeneration++
            CloudMusicSubmissionFileKind.LYRICS -> lyricsResolveGeneration++
        }
        setFileResolutionJob(kind, null)
    }

    private fun invalidateAllFileResolutions() {
        CloudMusicSubmissionFileKind.values().forEach(::invalidateFileResolution)
        _state.update {
            it.copy(
                audioResolving = false,
                coverResolving = false,
                lyricsResolving = false,
            )
        }
    }

    private fun CloudMusicSubmissionUiState.hasResolvingFile(): Boolean =
        audioResolving || coverResolving || lyricsResolving

    private fun nextFileResolution(kind: CloudMusicSubmissionFileKind): FileResolutionToken {
        synchronizeAccount()
        val generation = when (kind) {
            CloudMusicSubmissionFileKind.AUDIO -> ++audioResolveGeneration
            CloudMusicSubmissionFileKind.COVER -> ++coverResolveGeneration
            CloudMusicSubmissionFileKind.LYRICS -> ++lyricsResolveGeneration
        }
        return FileResolutionToken(
            kind = kind,
            generation = generation,
            accountGeneration = accountGeneration,
            userId = activeUserId,
        )
    }

    private fun isCurrent(token: FileResolutionToken): Boolean =
        token.accountGeneration == accountGeneration &&
            token.userId == activeUserId &&
            token.generation == when (token.kind) {
                CloudMusicSubmissionFileKind.AUDIO -> audioResolveGeneration
                CloudMusicSubmissionFileKind.COVER -> coverResolveGeneration
                CloudMusicSubmissionFileKind.LYRICS -> lyricsResolveGeneration
            }

    private fun fileResolutionJob(kind: CloudMusicSubmissionFileKind): Job? = when (kind) {
        CloudMusicSubmissionFileKind.AUDIO -> audioResolveJob
        CloudMusicSubmissionFileKind.COVER -> coverResolveJob
        CloudMusicSubmissionFileKind.LYRICS -> lyricsResolveJob
    }

    private fun setFileResolutionJob(kind: CloudMusicSubmissionFileKind, job: Job?) {
        when (kind) {
            CloudMusicSubmissionFileKind.AUDIO -> audioResolveJob = job
            CloudMusicSubmissionFileKind.COVER -> coverResolveJob = job
            CloudMusicSubmissionFileKind.LYRICS -> lyricsResolveJob = job
        }
    }

    private fun isCurrent(token: HistoryRequestToken): Boolean =
        token.userId == activeUserId &&
            token.accountGeneration == accountGeneration &&
            token.historyGeneration == historyGeneration

    private fun emitMessage(message: String) {
        _events.tryEmit(CloudMusicSubmissionEvent.ShowMessage(message))
    }

    private fun Throwable.messageOr(fallback: String): String = message?.takeIf { it.isNotBlank() } ?: fallback

    private data class OperationToken(
        val userId: String,
        val accountGeneration: Long,
        val operationGeneration: Long,
    )

    private data class FileResolutionToken(
        val kind: CloudMusicSubmissionFileKind,
        val generation: Long,
        val accountGeneration: Long,
        val userId: String?,
    )

    private data class HistoryRequestToken(
        val historyGeneration: Long,
        val accountGeneration: Long,
        val userId: String,
    )

    private data class NewSubmissionDraft(
        val stage: CloudMusicSubmissionStage,
        val audio: CloudMusicSubmissionFile?,
        val cover: CloudMusicSubmissionFile?,
        val lyrics: CloudMusicSubmissionFile?,
        val editingTrack: CloudMusicTrackDto?,
        val editorRevision: Long,
        val uploadPercent: Int,
        val uploadedCoverFile: CloudMusicSubmissionFile?,
        val uploadedLyricsFile: CloudMusicSubmissionFile?,
    ) {
        companion object {
            fun from(
                state: CloudMusicSubmissionUiState,
                uploadedCoverFile: CloudMusicSubmissionFile?,
                uploadedLyricsFile: CloudMusicSubmissionFile?,
            ) = NewSubmissionDraft(
                stage = state.stage,
                audio = state.audio,
                cover = state.cover,
                lyrics = state.lyrics,
                editingTrack = state.editingTrack,
                editorRevision = state.editorRevision,
                uploadPercent = state.uploadPercent,
                uploadedCoverFile = uploadedCoverFile,
                uploadedLyricsFile = uploadedLyricsFile,
            )
        }
    }

    private companion object {
        const val PAGE_SIZE = 30
        const val HISTORY_PREFETCH_DISTANCE = 5
        const val LOGIN_REQUIRED_MESSAGE = "请先登录 PisaMusic 账号"
        const val OPERATION_IN_PROGRESS_MESSAGE = "操作正在进行，请稍候"
        const val FILE_RESOLUTION_IN_PROGRESS_MESSAGE = "正在读取所选文件，请稍候"
        val RESUBMITTABLE_STATUSES = setOf("rejected", "pending_review")
        val EDITABLE_FILE_STAGES = setOf(
            CloudMusicSubmissionStage.SELECT_FILES,
            CloudMusicSubmissionStage.EDIT_METADATA,
        )
    }
}
