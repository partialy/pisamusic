package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.RenderEffect
import android.graphics.Shader
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.util.DisplayMetrics
import android.renderscript.Allocation
import android.renderscript.Element
import android.renderscript.RenderScript
import android.renderscript.ScriptIntrinsicBlur
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Toast
import androidx.coordinatorlayout.widget.CoordinatorLayout
import androidx.core.content.ContextCompat
import android.widget.SeekBar
import android.widget.TextView
import androidx.activity.addCallback
import androidx.annotation.OptIn
import androidx.core.graphics.drawable.toBitmap
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.LinearSmoothScroller
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityPlayerBinding
import cn.partialy.pm.databinding.LayoutListenTogetherBottomSheetBinding
import cn.partialy.pm.listen.ListenTogetherManager
import cn.partialy.pm.listen.ListenTogetherMember
import cn.partialy.pm.listen.ListenTogetherState
import cn.partialy.pm.listen.ListenTogetherUiEvent
import cn.partialy.pm.listen.targetPosition
import cn.partialy.pm.listen.toSongInfo
import cn.partialy.pm.lyric.LyricContent
import cn.partialy.pm.lyric.LyricParser
import cn.partialy.pm.lyric.LyricRepository
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.downloadOptionsForSongType
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.ui.dialog.SongMoreMenu
import cn.partialy.pm.ui.dialog.SongMoreMenuDependencies
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.showDownloadQualityPicker
import cn.partialy.pm.ui.player.LyricRow
import cn.partialy.pm.ui.player.LyricSettingsSheet
import cn.partialy.pm.ui.player.LyricsAdapter
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.AudioEmbeddedArtReader
import cn.partialy.pm.utils.LocalMediaIndexDbStore
import cn.partialy.pm.utils.LyricDisplayPrefs
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.utils.SongCoverUrl
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import coil.request.ImageRequest
import coil.transform.CircleCropTransformation
import coil.ImageLoader
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.color.MaterialColors
import com.google.android.material.imageview.ShapeableImageView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import kotlin.math.abs
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject

@AndroidEntryPoint
class PlayerActivity : BaseDownloadActivity() {
    protected override val defaultActivityTransitionEnabled: Boolean = false

    @Inject lateinit var mediaIndexDb: LocalMediaIndexDbStore
    @Inject lateinit var playlistCollectionManager: PlaylistCollectionManager
    @Inject lateinit var lyricRepository: LyricRepository
    @Inject lateinit var listenTogetherManager: ListenTogetherManager

    private lateinit var binding: ActivityPlayerBinding
    private lateinit var bottomSheetBehavior: BottomSheetBehavior<FrameLayout>
    private var listenTogetherDialog: BottomSheetDialog? = null
    private var listenTogetherSheetBinding: LayoutListenTogetherBottomSheetBinding? = null
    private lateinit var lyricsAdapter: LyricsAdapter
    private var lyricRows: List<LyricRow> = emptyList()
    private var lyricContent: LyricContent = LyricContent.noLyrics()
    private var lyricCurrentIndex: Int = -1
    private var lastUserLyricScrollAtMs: Long = 0L
    private var lyricScrollState: Int = RecyclerView.SCROLL_STATE_IDLE
    private var lyricCenterSeekIndex: Int = -1
    private var karaokeSyncJob: Job? = null
    private var karaokeBasePaddingTop: Int = -1
    private var karaokeBasePaddingBottom: Int = -1
    private var pendingSeekProgress: Int? = null
    /** 自动跟唱等代码触发的 [smoothScrollLyricsToCenter] 期间为 true，避免误显中线指示器。 */
    private var lyricsProgrammaticScrollInProgress: Boolean = false
    private val lyricSeekButtonHideRunnable = Runnable { updateLyricCenterSeekUi() }

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            binding = ActivityPlayerBinding.inflate(layoutInflater)
            setContentView(binding.root)
            enableEdgeToEdgeSystemBars(lightStatusBarIcons = false, lightNavigationBarIcons = false)
            applyInsets()

            setupBottomSheet()

            binding.playlistBottomSheet.playlistRecyclerView.apply {
                layoutManager = LinearLayoutManager(this@PlayerActivity)
                adapter = PlaylistAdapter(
                    songs = emptyList(),
                    currentPlayingId = musicController.currentSong.value?.id,
                    onItemClick = { song, index ->
                        lifecycleScope.launch {
                            val state = listenTogetherManager.state.value
                            val queueItemId = state.queue.items.getOrNull(index)?.queueItemId
                            if (state.enabled && queueItemId != null) {
                                listenTogetherManager.requestPlayQueueItem(queueItemId)
                            } else {
                                listenTogetherManager.requestPlaySong(song)
                            }
                            bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
                        }
                    },
                    onRemoveClick = { song, index ->
                        val state = listenTogetherManager.state.value
                        val queueItemId = state.queue.items.getOrNull(index)?.queueItemId
                        if (state.enabled && queueItemId != null) {
                            listenTogetherManager.requestRemoveQueueItem(queueItemId)
                        } else {
                            musicController.removeFromPlayList(song)
                        }
                    },
                )
            }

            observePlaylist()

            setupPlaybackControls()
            setupLyricsList()
            observePlaybackState()
            observeListenTogether()

            onBackPressedDispatcher.addCallback(this) {
                if (bottomSheetBehavior.state != BottomSheetBehavior.STATE_HIDDEN) {
                    bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
                } else {
                    finish()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            finish()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    @OptIn(UnstableApi::class)
    private fun setupPlaybackControls() {
        binding.collapseButton.setOnClickListener { finish() }

        binding.moreButton.setOnClickListener { openCurrentSongMoreMenu() }
        binding.listenTogetherChip.setOnClickListener { showListenTogetherSheet() }

        binding.listenTogetherButton.setOnClickListener { showListenTogetherSheet() }

        binding.lyricSettingsButton.setOnClickListener {
            LyricSettingsSheet.show(this) {
                lyricsAdapter.applyStyleFromPrefs(this@PlayerActivity)
                applyLyricDisplayMode()
            }
        }

        binding.progressBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    pendingSeekProgress = progress
                }
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {
                val progress = pendingSeekProgress ?: seekBar?.progress ?: return
                pendingSeekProgress = null
                val duration = musicController.duration.value
                val target = if (duration > 0L) (progress.toLong() * duration) / 100L else 0L
                listenTogetherManager.requestSeek(target)
            }
        })

        binding.playPauseButton.setOnClickListener {
            listenTogetherManager.requestTogglePlayPause()
        }

        binding.previousButton.setOnClickListener {
            listenTogetherManager.requestPrevious()
        }

        binding.nextButton.setOnClickListener {
            listenTogetherManager.requestNext()
        }

        binding.loveButton.setOnClickListener {
            lifecycleScope.launch {
                musicController.currentSong.value?.let { song ->
                    loveManager.toggleLikeStatus(song)
                    syncLoveButton(song)
                }
            }
        }

        binding.qualityButton.setOnClickListener {
            openPlaybackQualityPicker()
        }

        binding.downloadButton.setOnClickListener {
            lifecycleScope.launch {
                musicController.currentSong.value?.let { song -> onDownloadClick(song) }
            }
        }

        binding.repeatButton.setOnClickListener {
            musicController.togglePlayMode()
            updatePlayModeIcon()
        }

        binding.playListButton.setOnClickListener {
            updatePlaylist(musicController.playList.value)
            bottomSheetBehavior.state = BottomSheetBehavior.STATE_EXPANDED
            scrollPlaylistToNowPlaying()
        }

        updatePlayModeIcon()
    }

    private fun openPlaybackQualityPicker() {
        val song = musicController.currentSong.value
        if (song == null) {
            Toast.makeText(this, R.string.toast_no_current_song, Toast.LENGTH_SHORT).show()
            return
        }
        if (song.type == SongType.LOCAL) {
            Toast.makeText(this, R.string.local_song_no_online_quality, Toast.LENGTH_SHORT).show()
            return
        }

        val options = downloadOptionsForSongType(song.type)
        if (options.isEmpty()) {
            Toast.makeText(this, R.string.toast_playback_quality_no_options, Toast.LENGTH_SHORT).show()
            return
        }

        lifecycleScope.launch {
            val selected = showDownloadQualityPicker(
                context = this@PlayerActivity,
                songSubtitle = "${song.artist} - ${song.name}",
                options = options,
                title = getString(R.string.switch_playback_quality),
                confirmText = getString(R.string.switch_and_play),
                selectedQualityKey = SettingsPrefs.getPlaybackQualityKey(this@PlayerActivity, song.type),
            ) ?: return@launch

            val current = musicController.currentSong.value
            if (current == null || current.id != song.id || current.type != song.type) return@launch

            Toast.makeText(
                this@PlayerActivity,
                R.string.toast_playback_quality_switching,
                Toast.LENGTH_SHORT,
            ).show()
            val success = musicController.switchCurrentSongQuality(selected.choice)
            Toast.makeText(
                this@PlayerActivity,
                if (success) R.string.toast_playback_quality_changed else R.string.toast_playback_quality_failed,
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    private fun updatePlayModeIcon() {
        val mode = musicController.getPlayMode()
        val icon = when (mode) {
            SettingsPrefs.PlayMode.Order -> R.drawable.ic_repeat_24
            SettingsPrefs.PlayMode.Shuffle -> R.drawable.ic_shuffle_24
            SettingsPrefs.PlayMode.Single -> R.drawable.ic_repeat_one_24
        }
        binding.repeatButton.setImageResource(icon)
        binding.repeatButton.alpha = 1.0f
    }

    private fun openCurrentSongMoreMenu() {
        val song = musicController.currentSong.value
        if (song == null) {
            Toast.makeText(this, R.string.toast_no_current_song, Toast.LENGTH_SHORT).show()
            return
        }
        SongMoreMenu.show(
            this,
            song,
            SongMoreMenuDependencies(
                musicController = musicController,
                loveManager = loveManager,
                playlistCollectionManager = playlistCollectionManager,
                onDownloadClick = { startSongDownloadFlow(it) },
                showShare = true,
                onListenTogetherClick = { showListenTogetherSheet() },
            ),
        )
    }

    private fun observePlaybackState() {
        lifecycleScope.launch {
            musicController.isPlaying.collect { isPlaying ->
                val icon = if (isPlaying) R.drawable.ic_pause_24 else R.drawable.ic_play_24
                binding.playPauseButton.setImageResource(icon)
            }
        }

        lifecycleScope.launch {
            musicController.currentSong.collect { song ->
                (binding.playlistBottomSheet.playlistRecyclerView.adapter as? PlaylistAdapter)
                    ?.setCurrentPlayingId(song?.id)
                song?.let {
                    binding.songTitleTextView.text = it.name
                    binding.artistTextView.text = it.artist
                    SongSourceTagBinder.bind(
                        binding.songSourceTagTextView,
                        it.type,
                        SongSourceTagBinder.Surface.ON_DARK,
                    )
                    syncLoveButton(it)
                    applyLocalMediaFallbacks(it)
                    applyBlurBackground(modelForBlur(it))
                    if (it.type == SongType.LOCAL) {
                        submitLyrics(LyricContent.message("正在获取歌词..."))
                    }
                    submitLyrics(lyricRepository.loadLyrics(it))
                } ?: run {
                    SongSourceTagBinder.hide(binding.songSourceTagTextView)
                }
            }
        }

        lifecycleScope.launch {
            musicController.progress.collect { progress ->
                binding.progressBar.progress = progress.toInt()
            }
        }

        lifecycleScope.launch {
            musicController.currentPosition.collect { position ->
                binding.currentTimeTextView.text = formatTime(position.toInt())
                updateLyricTime(position)
            }
        }

        lifecycleScope.launch {
            musicController.duration.collect { duration ->
                binding.totalTimeTextView.text = formatTime(duration.toInt())
            }
        }

        lifecycleScope.launch {
            loveManager.loveListFlow.collect {
                musicController.currentSong.value?.let { syncLoveButton(it) }
            }
        }
    }

    private fun observeListenTogether() {
        lifecycleScope.launch {
            listenTogetherManager.state.collect { state ->
                renderListenTogetherChip(state)
                listenTogetherSheetBinding?.let { renderListenTogetherSheet(it, state) }
                updateEffectivePlaylist()
            }
        }
        lifecycleScope.launch {
            listenTogetherManager.uiEvents.collect { event ->
                when (event) {
                    is ListenTogetherUiEvent.Toast -> {
                        Toast.makeText(this@PlayerActivity, event.message, Toast.LENGTH_SHORT).show()
                    }
                    is ListenTogetherUiEvent.RequireLogin -> {
                        Toast.makeText(this@PlayerActivity, event.message, Toast.LENGTH_SHORT).show()
                        LoginActivity.start(this@PlayerActivity)
                    }
                    is ListenTogetherUiEvent.ConfirmReplaceRoom -> {
                        showReplaceListenTogetherRoomDialog(event.message)
                    }
                }
            }
        }
    }

    private fun showReplaceListenTogetherRoomDialog(message: String) {
        MaterialAlertDialogBuilder(this)
            .setTitle("创建新的听歌房")
            .setMessage(message)
            .setNegativeButton("取消", null)
            .setPositiveButton("确认") { _, _ ->
                lifecycleScope.launch {
                    listenTogetherManager.createRoom(
                        currentSong = musicController.currentSong.value,
                        replaceExisting = true,
                    )
                }
            }
            .show()
    }

    private fun renderListenTogetherChip(state: ListenTogetherState) {
        val room = state.room
        if (room == null) {
            binding.listenTogetherChip.visibility = View.GONE
            applyListenTogetherLyricSpacing()
            return
        }
        binding.listenTogetherChip.visibility = View.VISIBLE
        applyListenTogetherLyricSpacing()
        binding.listenTogetherChipPeopleText.text = "${room.displayPeople()}人一起听中"
        val latencyMs = state.latencyMs
        val latencyReady = state.socketConnected && latencyMs != null
        binding.listenTogetherChipLatencyText.text = if (latencyReady) "${latencyMs}ms" else "--ms"
        applyListenTogetherChipStatus(latencyReady)
        bindListenTogetherChipAvatars(room, state.currentUserId)
        binding.listenTogetherChip.post { applyListenTogetherLyricSpacing() }
    }

    private fun applyListenTogetherChipStatus(connected: Boolean) {
        val color = Color.parseColor(if (connected) "#34D399" else "#FBBF24")
        binding.listenTogetherChipStatusDot.backgroundTintList = ColorStateList.valueOf(color)
        binding.listenTogetherChipLatencyText.setTextColor(color)
    }

    private fun bindListenTogetherChipAvatars(
        room: cn.partialy.pm.listen.ListenTogetherRoom,
        currentUserId: String,
    ) {
        val displayMembers = room.members
            .filter { it.online }
            .ifEmpty { room.members }
            .sortedWith(
                compareBy<ListenTogetherMember> {
                    when (it.userId) {
                        room.hostUserId -> 0
                        currentUserId -> 1
                        else -> 2
                    }
                }.thenBy { it.joinedAt.takeIf { joinedAt -> joinedAt > 0L } ?: Long.MAX_VALUE }
                    .thenBy { it.displayName() },
            )
        bindListenTogetherAvatar(binding.listenTogetherAvatarFirst, displayMembers.getOrNull(0))
        bindListenTogetherAvatar(binding.listenTogetherAvatarSecond, displayMembers.getOrNull(1))
        binding.listenTogetherAvatarMoreBadge.visibility = if (displayMembers.size > 2) {
            View.VISIBLE
        } else {
            View.GONE
        }
    }

    private fun bindListenTogetherAvatar(
        imageView: ShapeableImageView,
        member: ListenTogetherMember?,
    ) {
        val avatarUrl = member?.avatarUrl.orEmpty()
        if (avatarUrl.isBlank()) {
            imageView.setImageResource(R.drawable.ic_pm_icon)
            return
        }
        imageView.load(avatarUrl) {
            crossfade(true)
            placeholder(R.drawable.ic_pm_icon)
            error(R.drawable.ic_pm_icon)
            transformations(CircleCropTransformation())
        }
    }

    private fun showListenTogetherSheet() {
        val dialog = BottomSheetDialog(
            this,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val sheetBinding = LayoutListenTogetherBottomSheetBinding.inflate(layoutInflater)
        listenTogetherDialog = dialog
        listenTogetherSheetBinding = sheetBinding

        val session = AccountSessionStore.read(this)
        val username = session.user.username.ifBlank { "我的" }
        sheetBinding.listenTogetherRoomNameLayout.placeholderText = "${username}的音乐房"
        sheetBinding.listenTogetherRoomIdInput.setText(generateRandomRoomId())
        sheetBinding.listenTogetherRoomIdInput.setSelection(
            sheetBinding.listenTogetherRoomIdInput.text?.length ?: 0,
        )

        val minPeople = 2
        val maxPeopleLimit = 8
        var currentMaxPeople = minPeople
        fun refreshMaxPeople() {
            sheetBinding.listenTogetherMaxPeopleValue.text =
                getString(R.string.listen_together_max_people_value, currentMaxPeople)
            sheetBinding.listenTogetherMaxPeopleMinus.isEnabled = currentMaxPeople > minPeople
            sheetBinding.listenTogetherMaxPeopleMinus.alpha =
                if (sheetBinding.listenTogetherMaxPeopleMinus.isEnabled) 1f else 0.4f
            sheetBinding.listenTogetherMaxPeoplePlus.isEnabled = currentMaxPeople < maxPeopleLimit
            sheetBinding.listenTogetherMaxPeoplePlus.alpha =
                if (sheetBinding.listenTogetherMaxPeoplePlus.isEnabled) 1f else 0.4f
        }
        refreshMaxPeople()
        sheetBinding.listenTogetherMaxPeopleMinus.setOnClickListener {
            if (currentMaxPeople > minPeople) {
                currentMaxPeople--
                refreshMaxPeople()
            }
        }
        sheetBinding.listenTogetherMaxPeoplePlus.setOnClickListener {
            if (currentMaxPeople < maxPeopleLimit) {
                currentMaxPeople++
                refreshMaxPeople()
            }
        }

        sheetBinding.listenTogetherMemberOperationSwitchCreate.isChecked = true
        sheetBinding.listenTogetherMemberOperationStatus.text =
            getString(R.string.listen_together_member_op_on)
        sheetBinding.listenTogetherMemberOperationSwitchCreate.setOnCheckedChangeListener { _, checked ->
            sheetBinding.listenTogetherMemberOperationStatus.text = getString(
                if (checked) R.string.listen_together_member_op_on
                else R.string.listen_together_member_op_off,
            )
        }

        sheetBinding.listenTogetherCloseButton.setOnClickListener { dialog.dismiss() }
        sheetBinding.listenTogetherCreateButton.setOnClickListener {
            val nameInput = sheetBinding.listenTogetherRoomNameInput.text?.toString()?.trim().orEmpty()
            val roomName = nameInput.ifBlank {
                sheetBinding.listenTogetherRoomNameLayout.placeholderText?.toString().orEmpty()
            }
            val roomId = sheetBinding.listenTogetherRoomIdInput.text?.toString()?.trim()
                ?.takeIf { it.isNotBlank() }
            val memberOperation = sheetBinding.listenTogetherMemberOperationSwitchCreate.isChecked
            val people = currentMaxPeople
            lifecycleScope.launch {
                listenTogetherManager.createRoom(
                    currentSong = musicController.currentSong.value,
                    roomName = roomName,
                    roomId = roomId,
                    maxPeople = people,
                    memberOperation = memberOperation,
                )
            }
        }
        sheetBinding.listenTogetherJoinButton.setOnClickListener {
            val roomId = sheetBinding.listenTogetherRoomInput.text?.toString().orEmpty()
            lifecycleScope.launch { listenTogetherManager.joinRoom(roomId) }
        }
        sheetBinding.listenTogetherScanJoinButton.setOnClickListener {
            Toast.makeText(this, R.string.listen_together_scan_unavailable, Toast.LENGTH_SHORT).show()
        }
        sheetBinding.listenTogetherCopyButton.setOnClickListener {
            val roomId = listenTogetherManager.state.value.room?.roomId ?: return@setOnClickListener
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Pisa Music 一起听房间号", roomId))
            Toast.makeText(this, "房间号已复制", Toast.LENGTH_SHORT).show()
        }
        sheetBinding.listenTogetherShareButton.setOnClickListener {
            val text = listenTogetherManager.shareText() ?: return@setOnClickListener
            startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, text)
            }, getString(R.string.listen_together_share_room)))
        }
        sheetBinding.listenTogetherLeaveButton.setOnClickListener {
            PmMinimalDialog.show(
                context = this,
                title = "退出当前一起听吗？",
                message = "退出后你将无法与朋友实时同步播放当前歌曲。",
                confirmText = "确认",
            ) {
                listenTogetherManager.leaveRoom()
                dialog.dismiss()
            }
        }

        renderListenTogetherSheet(sheetBinding, listenTogetherManager.state.value)
        dialog.setContentView(sheetBinding.root)
        dialog.setOnShowListener { applyListenTogetherSheetBehavior(dialog) }
        dialog.setOnDismissListener {
            if (listenTogetherDialog === dialog) {
                listenTogetherDialog = null
                listenTogetherSheetBinding = null
            }
        }
        dialog.show()
    }

    private fun renderListenTogetherSheet(
        sheetBinding: LayoutListenTogetherBottomSheetBinding,
        state: ListenTogetherState,
    ) {
        val room = state.room
        val currentSong = musicController.currentSong.value
        sheetBinding.listenTogetherCreateButton.isEnabled = !state.joining
        sheetBinding.listenTogetherCreateButton.alpha = if (state.joining) 0.6f else 1f
        sheetBinding.listenTogetherJoinButton.isEnabled = !state.joining
        sheetBinding.listenTogetherJoinButton.alpha = if (state.joining) 0.6f else 1f

        if (currentSong != null) {
            sheetBinding.listenTogetherCurrentSongName.text = currentSong.name
            sheetBinding.listenTogetherCurrentSongArtist.text = currentSong.artist
            val cover = currentSong.coverUrl
            if (cover.isNotBlank()) {
                sheetBinding.listenTogetherCurrentSongCover.load(cover)
            } else {
                sheetBinding.listenTogetherCurrentSongCover.setImageDrawable(null)
            }
        } else {
            sheetBinding.listenTogetherCurrentSongName.text = "暂无正在播放的歌曲"
            sheetBinding.listenTogetherCurrentSongArtist.text = ""
            sheetBinding.listenTogetherCurrentSongCover.setImageDrawable(null)
        }

        if (room == null) {
            sheetBinding.listenTogetherTitleView.text = getString(R.string.listen_together_title)
            sheetBinding.listenTogetherIdleGroup.visibility = View.VISIBLE
            sheetBinding.listenTogetherRoomGroup.visibility = View.GONE
            sheetBinding.listenTogetherSubtitleView.text = getString(R.string.listen_together_subtitle)
            return
        }

        sheetBinding.listenTogetherTitleView.text = getString(R.string.listen_together_active_title)
        sheetBinding.listenTogetherIdleGroup.visibility = View.GONE
        sheetBinding.listenTogetherRoomGroup.visibility = View.VISIBLE
        sheetBinding.listenTogetherSubtitleView.text = room.roomName
        sheetBinding.listenTogetherRoomInfoView.text = getString(
            R.string.listen_together_room_meta,
            room.roomId,
            room.displayPeople(),
        )
        val connection = if (state.socketConnected) {
            "同步正常"
        } else {
            getString(R.string.listen_together_reconnecting)
        }
        val control = when {
            state.isHost && room.memberOperation -> "你是房主 · 成员可操作"
            state.isHost -> "你是房主 · 仅房主控制"
            room.memberOperation -> "成员可操作"
            else -> getString(R.string.listen_together_only_host)
        }
        sheetBinding.listenTogetherSyncStatusView.text = "$connection · $control"

        val roomSong = room.song
        if (roomSong != null) {
            sheetBinding.listenTogetherRoomSongView.text = roomSong.name
            sheetBinding.listenTogetherRoomSongArtist.text = roomSong.singer
            sheetBinding.listenTogetherRoomSongArtist.visibility = View.VISIBLE
            val cover = roomSong.cover
            if (cover.isNotBlank()) {
                sheetBinding.listenTogetherRoomSongCover.load(cover) {
                    crossfade(true)
                }
            } else {
                sheetBinding.listenTogetherRoomSongCover.setImageDrawable(null)
            }
        } else {
            sheetBinding.listenTogetherRoomSongView.text =
                getString(R.string.listen_together_room_empty_song)
            sheetBinding.listenTogetherRoomSongArtist.text = ""
            sheetBinding.listenTogetherRoomSongArtist.visibility = View.GONE
            sheetBinding.listenTogetherRoomSongCover.setImageDrawable(null)
        }
        val durationMs = roomSong?.duration?.takeIf { it > 0L } ?: musicController.duration.value
        val positionMs = if (state.isHost) {
            musicController.currentPosition.value
        } else {
            room.targetPosition()
        }
        sheetBinding.listenTogetherRoomPositionView.text = getString(
            R.string.listen_together_position_value,
            formatListenTogetherTime(positionMs),
            formatListenTogetherTime(durationMs),
        )
        val latencyMs = state.latencyMs
        if (state.socketConnected && latencyMs != null && latencyMs >= 0) {
            sheetBinding.listenTogetherLatencyBadge.visibility = View.VISIBLE
            sheetBinding.listenTogetherLatencyView.text = getString(
                R.string.listen_together_latency_value,
                latencyMs,
            )
        } else {
            sheetBinding.listenTogetherLatencyBadge.visibility = View.GONE
        }

        populateListenTogetherMemberChips(sheetBinding.listenTogetherMembersView, room, state)

        sheetBinding.listenTogetherShareButton.isEnabled = true
        sheetBinding.listenTogetherQrButton.isEnabled = false
        sheetBinding.listenTogetherQrButton.alpha = 0.4f
        sheetBinding.listenTogetherMemberOperationSwitch.apply {
            setOnCheckedChangeListener(null)
            isChecked = room.memberOperation
            isEnabled = state.isHost && state.socketConnected
            alpha = if (state.isHost) 1f else 0.48f
            setOnCheckedChangeListener { _, checked ->
                val latest = listenTogetherManager.state.value.room?.memberOperation
                if (latest != checked) listenTogetherManager.updateMemberOperation(checked)
            }
        }
    }

    private fun populateListenTogetherMemberChips(
        container: LinearLayout,
        room: cn.partialy.pm.listen.ListenTogetherRoom,
        state: ListenTogetherState,
    ) {
        container.removeAllViews()
        val members = room.members
        if (members.isEmpty()) return
        val density = resources.displayMetrics.density
        fun dp(value: Float): Int = (value * density + 0.5f).toInt()
        val sorted = members.sortedWith(
            compareBy<ListenTogetherMember> {
                if (it.userId == room.hostUserId) 0 else 1
            }.thenBy {
                if (it.userId == state.currentUserId) 0 else 1
            }.thenBy { it.displayName() },
        )
        sorted.forEachIndexed { index, member ->
            val isHost = member.userId == room.hostUserId
            val isMe = member.userId == state.currentUserId
            val chip = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                background = ContextCompat.getDrawable(
                    this@PlayerActivity,
                    if (isHost) R.drawable.bg_listen_together_member_chip_host
                    else R.drawable.bg_listen_together_member_chip,
                )
                setPadding(dp(10f), dp(5f), dp(12f), dp(5f))
                val lp = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                )
                if (index > 0) lp.marginStart = dp(8f)
                layoutParams = lp
            }
            val avatar = ImageView(this).apply {
                val size = dp(20f)
                layoutParams = LinearLayout.LayoutParams(size, size)
                scaleType = ImageView.ScaleType.CENTER_CROP
                contentDescription = member.displayName()
                val url = member.avatarUrl
                if (url.isNotBlank()) {
                    load(url) {
                        transformations(coil.transform.CircleCropTransformation())
                        placeholder(R.drawable.ic_pm_icon)
                        error(R.drawable.ic_pm_icon)
                    }
                } else {
                    load(R.drawable.ic_pm_icon) {
                        transformations(coil.transform.CircleCropTransformation())
                    }
                }
            }
            chip.addView(avatar)
            val nameLabel = if (isMe) getString(R.string.listen_together_role_me)
            else member.displayName()
            val nameView = TextView(this).apply {
                text = if (isHost && !isMe) "$nameLabel ${getString(R.string.listen_together_role_host)}" else nameLabel
                textSize = 12f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(
                    ContextCompat.getColor(
                        this@PlayerActivity,
                        if (isHost) R.color.listen_together_member_chip_host_text
                        else R.color.listen_together_member_chip_text,
                    ),
                )
                val lp = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                )
                lp.marginStart = dp(6f)
                layoutParams = lp
            }
            chip.addView(nameView)
            container.addView(chip)
        }
    }

    private fun formatListenTogetherTime(ms: Long): String {
        val safe = ms.coerceAtLeast(0L)
        val totalSec = safe / 1000L
        val mm = totalSec / 60L
        val ss = totalSec % 60L
        return String.format(java.util.Locale.US, "%02d:%02d", mm, ss)
    }

    private fun applyListenTogetherSheetBehavior(dialog: BottomSheetDialog) {
        val bottomSheet = dialog.findViewById<View>(
            com.google.android.material.R.id.design_bottom_sheet,
        ) ?: return
        val capHeight = (resources.displayMetrics.heightPixels * 0.8f).toInt()
        bottomSheet.layoutParams = bottomSheet.layoutParams.apply {
            height = ViewGroup.LayoutParams.WRAP_CONTENT
        }
        BottomSheetBehavior.from(bottomSheet as ViewGroup).apply {
            skipCollapsed = true
            isFitToContents = true
            isDraggable = true
            maxHeight = capHeight
            state = BottomSheetBehavior.STATE_EXPANDED
        }
        bottomSheet.requestLayout()
    }

    private fun generateRandomRoomId(): String = (100000..999999).random().toString()

    private fun syncLoveButton(song: SongInfo) {
        val liked = loveManager.isSongInLoveList(song)
        binding.loveButton.setImageResource(if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24)
        binding.loveButton.setColorFilter(
            ContextCompat.getColor(this, if (liked) R.color.red else android.R.color.white)
        )
    }

    private fun setupLyricsList() {
        lyricsAdapter = LyricsAdapter()
        lyricsAdapter.applyStyleFromPrefs(this)
        binding.lyricCenterSeekOverlay.setOnClickListener {
            val idx = lyricCenterSeekIndex
            val rows = lyricRows
            if (idx < 0 || idx >= rows.size) return@setOnClickListener
            binding.lyricsRecyclerView.removeCallbacks(lyricSeekButtonHideRunnable)
            binding.lyricCenterSeekOverlay.visibility = View.GONE
            lastUserLyricScrollAtMs = SystemClock.elapsedRealtime()
            lifecycleScope.launch {
                binding.karaokeLyricsView.resumeAutoScroll()
                listenTogetherManager.requestSeek(rows[idx].startTime)
            }
        }
        binding.karaokeLyricsView.onBrowseLineChanged = { idx ->
            lyricCenterSeekIndex = idx
            updateKaraokeCenterSeekUi()
        }
        binding.karaokeLyricsView.onBrowseEnded = {
            if (binding.karaokeLyricsView.visibility == View.VISIBLE) {
                binding.lyricCenterSeekOverlay.visibility = View.GONE
                lyricCenterSeekIndex = -1
            }
        }
        binding.lyricsRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@PlayerActivity)
            adapter = lyricsAdapter
            itemAnimator = null
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
                    super.onScrollStateChanged(recyclerView, newState)
                    lyricScrollState = newState
                    if (newState == RecyclerView.SCROLL_STATE_DRAGGING) {
                        lastUserLyricScrollAtMs = SystemClock.elapsedRealtime()
                        lyricsProgrammaticScrollInProgress = false
                    }
                    if (newState == RecyclerView.SCROLL_STATE_IDLE) {
                        lyricsProgrammaticScrollInProgress = false
                    }
                    updateLyricCenterSeekUi()
                }

                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (lyricsProgrammaticScrollInProgress) return
                    updateLyricCenterSeekUi()
                }
            })
            addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
                applyLyricsRecyclerVerticalPadding()
            }
        }
    }

    /** 与 [smoothScrollLyricsToCenter] 使用同一竖直中线，取距中线最近的一行。 */
    private fun findLyricIndexAtCenter(): Int {
        val rv = binding.lyricsRecyclerView
        val lm = rv.layoutManager as? LinearLayoutManager ?: return -1
        if (rv.height <= 0) return -1
        val parentCenter =
            rv.paddingTop + (rv.height - rv.paddingTop - rv.paddingBottom) / 2
        var bestPos = -1
        var bestDist = Int.MAX_VALUE
        val first = lm.findFirstVisibleItemPosition()
        val last = lm.findLastVisibleItemPosition()
        if (first == RecyclerView.NO_POSITION || last == RecyclerView.NO_POSITION) return -1
        for (i in first..last) {
            val child = lm.findViewByPosition(i) ?: continue
            val childCenter = (child.top + child.bottom) / 2
            val dist = abs(childCenter - parentCenter)
            if (dist < bestDist) {
                bestDist = dist
                bestPos = i
            }
        }
        return bestPos
    }

    private fun updateLyricCenterSeekUi() {
        val rv = binding.lyricsRecyclerView
        rv.removeCallbacks(lyricSeekButtonHideRunnable)
        val overlay = binding.lyricCenterSeekOverlay
        if (binding.karaokeLyricsView.visibility == View.VISIBLE) {
            updateKaraokeCenterSeekUi()
            return
        }
        if (lyricsProgrammaticScrollInProgress) {
            overlay.visibility = View.GONE
            return
        }
        lyricCenterSeekIndex = findLyricIndexAtCenter()
        val rows = lyricRows
        if (rows.isEmpty()) {
            overlay.visibility = View.GONE
            return
        }
        val since = SystemClock.elapsedRealtime() - lastUserLyricScrollAtMs
        val inBrowseWindow = since < 3_000
        // 仅用户拖动/惯性滚动后的浏览窗口内显示；自动跟唱滚动由 lyricsProgrammaticScrollInProgress 屏蔽
        val show =
            lyricScrollState == RecyclerView.SCROLL_STATE_DRAGGING ||
                lyricScrollState == RecyclerView.SCROLL_STATE_SETTLING ||
                (lyricScrollState == RecyclerView.SCROLL_STATE_IDLE && inBrowseWindow)
        val visible = show && lyricCenterSeekIndex >= 0
        overlay.visibility = if (visible) View.VISIBLE else View.GONE
        if (visible && lyricCenterSeekIndex < rows.size) {
            binding.lyricCenterSeekTimeText.text =
                formatTime(rows[lyricCenterSeekIndex].startTime.toInt())
        }
        if (show && lyricScrollState == RecyclerView.SCROLL_STATE_IDLE && inBrowseWindow) {
            val delay = (3_000 - since).coerceAtLeast(0L)
            rv.postDelayed(lyricSeekButtonHideRunnable, delay)
        }
    }

    private fun updateKaraokeCenterSeekUi() {
        val overlay = binding.lyricCenterSeekOverlay
        val rows = lyricRows
        val idx = binding.karaokeLyricsView.browsedLineIndex
        lyricCenterSeekIndex = idx
        if (binding.karaokeLyricsView.visibility != View.VISIBLE || idx !in rows.indices) {
            overlay.visibility = View.GONE
            return
        }
        binding.lyricCenterSeekTimeText.text = formatTime(rows[idx].startTime.toInt())
        overlay.visibility = View.VISIBLE
    }

    /** 上下各约为列表可视高度一半，首尾句可滚到与当前高亮相同的竖直中线位置。 */
    private fun applyLyricsRecyclerVerticalPadding() {
        val rv = binding.lyricsRecyclerView
        val h = rv.height
        if (h <= 0) return
        val bottomPad = h / 2
        val topPad = bottomPad + listenTogetherLyricTopOffsetPx()
        if (rv.paddingTop == topPad && rv.paddingBottom == bottomPad) return
        rv.updatePadding(top = topPad, bottom = bottomPad)
        if (lyricCurrentIndex >= 0) {
            rv.post {
                smoothScrollLyricsToCenter(lyricCurrentIndex)
                updateLyricCenterSeekUi()
            }
        }
    }

    private fun applyListenTogetherLyricSpacing() {
        binding.lyricsRecyclerView.post { applyLyricsRecyclerVerticalPadding() }
        applyKaraokeListenTogetherPadding()
    }

    private fun applyKaraokeListenTogetherPadding() {
        val view = binding.karaokeLyricsView
        if (karaokeBasePaddingTop < 0) {
            karaokeBasePaddingTop = view.paddingTop
            karaokeBasePaddingBottom = view.paddingBottom
        }
        view.updatePadding(
            top = karaokeBasePaddingTop + listenTogetherLyricTopOffsetPx(),
            bottom = karaokeBasePaddingBottom,
        )
    }

    private fun listenTogetherLyricTopOffsetPx(): Int {
        if (listenTogetherManager.state.value.room == null) return 0
        val measuredChipHeight = binding.listenTogetherChip.height
        return measuredChipHeight.takeIf { it > 0 } ?: dp(48)
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private fun submitLyrics(content: LyricContent) {
        lyricContent = content
        lyricRows = content.displayLines
        lyricCurrentIndex = if (lyricRows.isEmpty()) -1 else 0
        applyLyricDisplayMode()
        lyricsAdapter.submitList(lyricRows) {
            lyricsAdapter.setCurrentIndex(lyricCurrentIndex)
            if (lyricCurrentIndex >= 0) {
                binding.lyricsRecyclerView.post { smoothScrollLyricsToCenter(lyricCurrentIndex) }
            }
            binding.lyricsRecyclerView.post { updateLyricCenterSeekUi() }
        }
    }

    private fun updateLyricTime(currentTime: Long) {
        val rows = lyricRows
        if (rows.isEmpty()) return
        val current = LyricParser.findCurrentLine(rows, currentTime) ?: return
        updateKaraokeLyricsView(currentTime, current.index)
        val idx = current.index
        if (idx == lyricCurrentIndex) return
        lyricCurrentIndex = idx
        lyricsAdapter.setCurrentIndex(idx)
        val sinceUser = SystemClock.elapsedRealtime() - lastUserLyricScrollAtMs
        if (sinceUser >= 3_000 && binding.karaokeLyricsView.visibility != View.VISIBLE) {
            smoothScrollLyricsToCenter(idx)
        }
    }

    private fun smoothScrollLyricsToCenter(position: Int) {
        val lm = binding.lyricsRecyclerView.layoutManager as? LinearLayoutManager ?: return
        if (binding.lyricsRecyclerView.height <= 0) return
        val scroller = object : LinearSmoothScroller(this) {
            override fun getVerticalSnapPreference(): Int = SNAP_TO_ANY

            /** 默认约 25ms/inch，短距离跟唱常在百毫秒内结束，观感像「闪一下」。略放慢并加最短滚动时长。 */
            override fun calculateSpeedPerPixel(displayMetrics: DisplayMetrics): Float =
                40f / displayMetrics.densityDpi

            override fun calculateTimeForScrolling(dx: Int): Int =
                super.calculateTimeForScrolling(dx).coerceAtLeast(240)

            override fun calculateDyToMakeVisible(view: View, snapPreference: Int): Int {
                val parentCenter =
                    (binding.lyricsRecyclerView.paddingTop +
                        (binding.lyricsRecyclerView.height - binding.lyricsRecyclerView.paddingTop - binding.lyricsRecyclerView.paddingBottom) / 2)
                val childCenter = (view.top + view.bottom) / 2
                // dy>0 表示内容上移（向下滚动），dy<0 表示内容下移（向上滚动）
                return parentCenter - childCenter
            }
        }
        scroller.targetPosition = position
        lyricsProgrammaticScrollInProgress = true
        lm.startSmoothScroll(scroller)
    }

    private fun applyLyricDisplayMode() {
        val useKaraoke = LyricDisplayPrefs.isUseWordLyricEnabled(this) && lyricContent.hasWordTiming
        binding.karaokeLyricsView.visibility = if (useKaraoke) View.VISIBLE else View.GONE
        binding.lyricsRecyclerView.visibility = if (useKaraoke) View.GONE else View.VISIBLE
        applyListenTogetherLyricSpacing()
        if (useKaraoke) {
            binding.lyricCenterSeekOverlay.visibility = View.GONE
            updateKaraokeLyricsView(currentPlaybackPositionMs())
            startKaraokeSync()
        } else {
            binding.karaokeLyricsView.resumeAutoScroll()
            stopKaraokeSync()
        }
    }

    private fun startKaraokeSync() {
        if (karaokeSyncJob?.isActive == true) return
        karaokeSyncJob = lifecycleScope.launch {
            while (isActive) {
                updateKaraokeLyricsView(currentPlaybackPositionMs())
                delay(KARAOKE_SYNC_INTERVAL_MS)
            }
        }
    }

    private fun stopKaraokeSync() {
        karaokeSyncJob?.cancel()
        karaokeSyncJob = null
    }

    private fun updateKaraokeLyricsView(positionMs: Long, index: Int? = null) {
        if (binding.karaokeLyricsView.visibility != View.VISIBLE) return
        val current = if (index != null) {
            LyricParser.findCurrentLine(lyricRows, positionMs)?.takeIf { it.index == index }
        } else {
            LyricParser.findCurrentLine(lyricRows, positionMs)
        } ?: return
        if (current.index != lyricCurrentIndex) {
            lyricCurrentIndex = current.index
            lyricsAdapter.setCurrentIndex(current.index)
        }
        binding.karaokeLyricsView.bind(
            lines = lyricRows,
            currentIndex = current.index,
            positionMs = positionMs,
            style = LyricDisplayPrefs.readStyle(this),
            isPlaying = musicController.isPlaying.value
        )
    }

    private fun currentPlaybackPositionMs(): Long =
        musicController.exoPlayer?.currentPosition ?: musicController.currentPosition.value

    override fun onDestroy() {
        stopKaraokeSync()
        super.onDestroy()
    }

    private fun modelForBlur(song: SongInfo): Any? =
        SongCoverUrl.getSongCoverData(song, SongCoverUrl.SIZE_XLARGE)

    private suspend fun applyLocalMediaFallbacks(song: SongInfo) {
        if (song.coverUrl.isNotBlank()) {
            withContext(Dispatchers.IO) {
                mediaIndexDb.upsertCover(song, source = "remote_url", value = song.coverUrl)
            }
        }
        if (song.type != SongType.LOCAL) return
        if (song.embeddedCoverArt == null) {
            val bytes = withContext(Dispatchers.IO) {
                AudioEmbeddedArtReader.readEmbeddedCoverBytes(this@PlayerActivity, File(song.id))
            }
            if (bytes != null && bytes.isNotEmpty()) {
                song.embeddedCoverArt = bytes
                withContext(Dispatchers.IO) {
                    mediaIndexDb.upsertCover(song, source = "embedded", value = song.id)
                }
            }
        } else {
            withContext(Dispatchers.IO) {
                mediaIndexDb.upsertCover(song, source = "embedded", value = song.id)
            }
        }
    }

    private fun applyBlurBackground(model: Any?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            binding.blurredBgImageView.load(model) {
                crossfade(true)
                placeholder(R.drawable.ic_pisa_piece_24)
                error(R.drawable.ic_pisa_piece_24)
            }
            binding.blurredBgImageView.setRenderEffect(
                RenderEffect.createBlurEffect(400f, 400f, Shader.TileMode.CLAMP)
            )
        } else {
            val request = ImageRequest.Builder(this)
                .data(model)
                .target { drawable ->
                    val bitmap = drawable.toBitmap()
                    val blurred = blurBitmapWithRenderScript(bitmap, 25f)
                    binding.blurredBgImageView.setImageBitmap(blurred)
                }
                .build()
            ImageLoader(this).enqueue(request)
        }
    }

    @Suppress("DEPRECATION")
    private fun blurBitmapWithRenderScript(source: Bitmap, radius: Float): Bitmap {
        val scaledWidth = (source.width / 8).coerceAtLeast(1)
        val scaledHeight = (source.height / 8).coerceAtLeast(1)
        val input = Bitmap.createScaledBitmap(source, scaledWidth, scaledHeight, true)
        val output = Bitmap.createBitmap(input.width, input.height, Bitmap.Config.ARGB_8888)

        val rs = RenderScript.create(this)
        val script = ScriptIntrinsicBlur.create(rs, Element.U8_4(rs))
        val allocIn = Allocation.createFromBitmap(rs, input)
        val allocOut = Allocation.createFromBitmap(rs, output)
        script.setRadius(radius)
        script.setInput(allocIn)
        script.forEach(allocOut)
        allocOut.copyTo(output)

        script.destroy()
        allocIn.destroy()
        allocOut.destroy()
        rs.destroy()

        return output
    }

    private fun formatTime(milliseconds: Int): String {
        val seconds = milliseconds / 1000
        val minutes = seconds / 60
        val remainingSeconds = seconds % 60
        return String.format("%02d:%02d", minutes, remainingSeconds)
    }

    private fun observePlaylist() {
        lifecycleScope.launch {
            musicController.playList.collect {
                updateEffectivePlaylist()
            }
        }
    }

    private fun updateEffectivePlaylist() {
        val state = listenTogetherManager.state.value
        val songs = if (state.enabled) {
            state.queue.items.map { it.song.toSongInfo() }
        } else {
            musicController.playList.value
        }
        updatePlaylist(songs)
    }

    private fun updatePlaylist(songs: List<SongInfo>) {
        val adapter = binding.playlistBottomSheet.playlistRecyclerView.adapter as? PlaylistAdapter ?: return
        adapter.updateSongs(songs)
        findViewById<TextView>(R.id.playingQueueTitle)?.text = if (listenTogetherManager.state.value.enabled) {
            "一起听队列(${songs.size}首)"
        } else {
            "播放队列(${songs.size}首)"
        }
        binding.playlistBottomSheet.clearPlayList.isEnabled = !listenTogetherManager.state.value.enabled
        binding.playlistBottomSheet.clearPlayList.alpha = if (listenTogetherManager.state.value.enabled) 0.36f else 1f
        if (songs.isEmpty()) {
            binding.playlistBottomSheet.playlistEmptyText.visibility = View.VISIBLE
            binding.playlistBottomSheet.playlistRecyclerView.visibility = View.GONE
        } else {
            binding.playlistBottomSheet.playlistEmptyText.visibility = View.GONE
            binding.playlistBottomSheet.playlistRecyclerView.visibility = View.VISIBLE
        }
    }

    private fun scrollPlaylistToNowPlaying() {
        val rv = binding.playlistBottomSheet.playlistRecyclerView
        val state = listenTogetherManager.state.value
        val songs = if (state.enabled) state.queue.items.map { it.song.toSongInfo() } else musicController.playList.value
        if (songs.isEmpty()) return
        val currentId = musicController.currentSong.value?.id ?: return
        val idx = songs.indexOfFirst { it.id == currentId }
        if (idx < 0) return

        rv.post {
            (rv.layoutManager as? LinearLayoutManager)
                ?.scrollToPositionWithOffset(idx, rv.height / 3)
                ?: rv.scrollToPosition(idx)
        }
    }

    @SuppressLint("SetTextI18n")
    private fun setupBottomSheet() {
        val bottomSheet = binding.standardBottomSheet
        val screenHeight = resources.displayMetrics.heightPixels
        val sheetHeight = (screenHeight * 0.7f).toInt()
        (bottomSheet.layoutParams as CoordinatorLayout.LayoutParams).height = sheetHeight

        bottomSheetBehavior = BottomSheetBehavior.from(bottomSheet)
        bottomSheetBehavior.maxHeight = sheetHeight
        bottomSheetBehavior.apply {
            isFitToContents = true
            isHideable = true
            state = BottomSheetBehavior.STATE_HIDDEN
            peekHeight = (screenHeight * 0.4).toInt()
        }

        val title = findViewById<TextView>(R.id.playingQueueTitle)
        title?.apply {
            text = "播放队列(${musicController.playList.value.size}首)"
        }

        binding.playlistBottomSheet.clearPlayList.setOnClickListener {
            if (listenTogetherManager.state.value.enabled) {
                Toast.makeText(this, "一起听暂不支持清空队列", Toast.LENGTH_SHORT).show()
            } else {
                musicController.clearPlayList()
                bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
            }
        }

        binding.dimOverlay.setOnClickListener {
            bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
        }

        binding.playlistBottomSheet.root.setOnClickListener { }

        bottomSheetBehavior.addBottomSheetCallback(object : BottomSheetBehavior.BottomSheetCallback() {
            override fun onStateChanged(bottomSheet: View, newState: Int) {
                when (newState) {
                    BottomSheetBehavior.STATE_HIDDEN -> {
                        binding.dimOverlay.animate()
                            .alpha(0f)
                            .setDuration(200)
                            .withEndAction { binding.dimOverlay.visibility = View.GONE }
                    }
                    else -> {
                        if (binding.dimOverlay.visibility == View.GONE) {
                            binding.dimOverlay.alpha = 0f
                            binding.dimOverlay.visibility = View.VISIBLE
                            binding.dimOverlay.animate().alpha(1f).setDuration(200)
                        }
                    }
                }
            }

            override fun onSlide(bottomSheet: View, slideOffset: Float) {
                if (slideOffset >= 0) {
                    binding.dimOverlay.visibility = View.VISIBLE
                    binding.dimOverlay.alpha = slideOffset
                } else {
                    binding.dimOverlay.visibility = View.GONE
                }
            }
        })
    }

    private fun applyInsets() {
        binding.playerRoot.applySystemBarsInsets { insets ->
            binding.headerBar.updatePadding(top = insets.top)
            binding.controlsLayout.updatePadding(bottom = insets.bottom + (resources.displayMetrics.density * 16).toInt())
            binding.standardBottomSheet.updatePadding(bottom = insets.bottom)
        }
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyPlayerBack(this)
    }

    companion object {
        private const val KARAOKE_SYNC_INTERVAL_MS = 100L

        fun createLaunchIntent(context: Context): Intent =
            Intent(context, PlayerActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }

        fun start(context: Context) {
            val intent = createLaunchIntent(context)
            if (context !is Activity) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            AppActivityTransitions.applyPlayerForward(context)
        }
    }
}

class PlaylistAdapter(
    private var songs: List<SongInfo>,
    private var currentPlayingId: String?,
    private val onItemClick: (SongInfo, Int) -> Unit,
    private val onRemoveClick: (SongInfo, Int) -> Unit,
) : RecyclerView.Adapter<PlaylistAdapter.ViewHolder>() {

    fun updateSongs(newSongs: List<SongInfo>) {
        val diff = DiffUtil.calculateDiff(SongDiffCallback(songs, newSongs))
        songs = newSongs
        diff.dispatchUpdatesTo(this)
    }

    fun setCurrentPlayingId(id: String?) {
        if (currentPlayingId == id) return
        val oldIdx = songs.indexOfFirst { it.id == currentPlayingId }
        val newIdx = songs.indexOfFirst { it.id == id }
        currentPlayingId = id
        if (oldIdx >= 0) notifyItemChanged(oldIdx)
        if (newIdx >= 0) notifyItemChanged(newIdx)
    }

    private class SongDiffCallback(
        private val old: List<SongInfo>,
        private val new: List<SongInfo>,
    ) : DiffUtil.Callback() {
        override fun getOldListSize() = old.size
        override fun getNewListSize() = new.size
        override fun areItemsTheSame(o: Int, n: Int) =
            old[o].type == new[n].type && old[o].id == new[n].id
        override fun areContentsTheSame(o: Int, n: Int) =
            old[o].name == new[n].name && old[o].artist == new[n].artist
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_playlist_song, parent, false)
        return ViewHolder(view, onRemoveClick)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val song = songs[position]
        val isCurrent = song.id == currentPlayingId
        holder.bind(song, isCurrent)
        holder.itemView.setOnClickListener {
            val pos = holder.bindingAdapterPosition
            if (pos != RecyclerView.NO_POSITION) onItemClick(song, pos)
        }
    }

    override fun getItemCount() = songs.size

    class ViewHolder(
        view: View,
        private val onRemoveClick: (SongInfo, Int) -> Unit,
    ) : RecyclerView.ViewHolder(view) {
        private val lineText: TextView = view.findViewById(R.id.songLineText)
        private val tagView: TextView = view.findViewById(R.id.songSourceTagTextView)
        private val removeButton: View = view.findViewById(R.id.removeFromPlayList)

        fun bind(song: SongInfo, isCurrent: Boolean) {
            val ctx = itemView.context
            val separator = " - "
            removeButton.setOnClickListener {
                val pos = bindingAdapterPosition
                if (pos != RecyclerView.NO_POSITION) onRemoveClick(song, pos)
            }
            SongSourceTagBinder.bind(tagView, song.type)

            if (isCurrent) {
                itemView.setBackgroundColor(
                    ContextCompat.getColor(ctx, R.color.playlist_now_playing_row_bg),
                )
                lineText.text = buildString {
                    append(song.name)
                    append(separator)
                    append(song.artist)
                }
                lineText.setTextColor(ContextCompat.getColor(ctx, R.color.playlist_playing_text))
            } else {
                itemView.setBackgroundColor(Color.TRANSPARENT)
                val onSurface = MaterialColors.getColor(
                    itemView,
                    com.google.android.material.R.attr.colorOnSurface,
                    Color.BLACK,
                )
                val artistColor = ContextCompat.getColor(ctx, R.color.playlist_item_artist)
                val ssb = SpannableStringBuilder().apply {
                    append(song.name)
                    setSpan(
                        ForegroundColorSpan(onSurface),
                        0,
                        song.name.length,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                    )
                    append(separator)
                    append(song.artist)
                    setSpan(
                        ForegroundColorSpan(artistColor),
                        song.name.length,
                        length,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                    )
                }
                lineText.text = ssb
            }
        }
    }
}
