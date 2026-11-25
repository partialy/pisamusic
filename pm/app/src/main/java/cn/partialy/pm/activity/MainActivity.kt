package cn.partialy.pm.activity

import cn.partialy.pm.ui.message.PmMessage
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewConfiguration
import android.view.animation.DecelerateInterpolator
import android.widget.PopupMenu
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import android.widget.LinearLayout
import androidx.activity.OnBackPressedCallback
import androidx.annotation.OptIn
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.media3.common.util.UnstableApi
import androidx.viewpager2.widget.ViewPager2
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityMainBinding
import cn.partialy.pm.databinding.MainDrawerContentBinding
import cn.partialy.pm.ui.drawer.DrawerDynamicMenusController
import cn.partialy.pm.ui.drawer.DrawerQuickActions
import cn.partialy.pm.ui.drawer.SidebarMenuRepository
import cn.partialy.pm.ui.home.MainDrawerOverlayLayout
import cn.partialy.pm.ui.home.MainStartupCoordinator
import cn.partialy.pm.announcement.AnnouncementDetailBottomSheet
import cn.partialy.pm.directmessage.DirectMessageCheckSource
import cn.partialy.pm.directmessage.DirectMessageCoordinator
import cn.partialy.pm.model.AnnouncementItem
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.player.SleepTimerManager
import cn.partialy.pm.player.SleepTimerRules
import cn.partialy.pm.player.SleepTimerState
import cn.partialy.pm.listen.ListenTogetherScanLink
import cn.partialy.pm.listening.ListeningManager
import cn.partialy.pm.share.ShareLink
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.network.config.StartupSnapshotStore
import cn.partialy.pm.network.cookie.ThirdPartyAccountsRepository
import cn.partialy.pm.network.cookie.ThirdPartyLoginValidity
import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.repository.SystemRepository
import cn.partialy.pm.service.MusicService
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.ui.dialog.ModernDialog
import cn.partialy.pm.ui.dialog.PlaylistLinkImportDialog
import cn.partialy.pm.ui.dialog.SleepTimerBottomSheet
import cn.partialy.pm.ui.discover.DiscoverFragment
import cn.partialy.pm.ui.home.HomeFragmentStateAdapter
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.mine.MineFragment
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.DownloadPathManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.color.MaterialColors
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import dagger.hilt.android.AndroidEntryPoint
import coil.load
import coil.transform.CircleCropTransformation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine


@AndroidEntryPoint
class MainActivity : BaseDownloadActivity() {
    protected override val defaultActivityTransitionEnabled: Boolean = false

    private lateinit var binding: ActivityMainBinding

    @Inject
    lateinit var systemRepository: SystemRepository

    @Inject
    lateinit var playlistCollectionManager: PlaylistCollectionManager

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var startupSnapshotStore: StartupSnapshotStore

    @Inject
    lateinit var wyCookieRepository: WyCookieRepository

    @Inject
    lateinit var thirdPartyAccountsRepository: ThirdPartyAccountsRepository

    @Inject
    lateinit var syncManager: SyncManager

    @Inject
    lateinit var listeningManager: ListeningManager

    @Inject
    lateinit var directMessageCoordinator: DirectMessageCoordinator

    @Inject
    lateinit var sleepTimerManager: SleepTimerManager

    @Inject
    lateinit var sidebarMenuRepository: SidebarMenuRepository

    private lateinit var viewPager: ViewPager2
    private lateinit var homeAdapter: HomeFragmentStateAdapter
    private val baseBottomNavPadding by lazy { (resources.displayMetrics.density * 8).toInt() }
    private var homeMiniPlayerBinder: HomeMiniPlayerBinder? = null
    private var startupCoordinator: MainStartupCoordinator? = null

    private var mainDrawerOpen = false
    private var drawerDragStartTranslationX = 0f
    private val mainDrawerWidthPx: Int
        get() = resources.getDimensionPixelSize(R.dimen.main_drawer_width)
    private val drawerFlingVelocityThresholdPx: Float
        get() = ViewConfiguration.get(this).scaledMinimumFlingVelocity * 4f
    private lateinit var drawerBackCallback: OnBackPressedCallback

    private var drawerContentBinding: MainDrawerContentBinding? = null
    private var drawerQuickActions: DrawerQuickActions? = null
    private var drawerDynamicMenusController: DrawerDynamicMenusController? = null

    private var localModeReason: String? = null
    private var currentTopLevelDestination = MainTopLevelDestination.HOME

    private val drawerScanLauncher = registerForActivityResult(ScanContract()) { result ->
        val contents = result.contents
        if (contents.isNullOrBlank()) {
            PmMessage.info(this, R.string.drawer_scan_cancelled)
        } else {
            handleScanContent(contents)
        }
    }

    @OptIn(UnstableApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        currentTopLevelDestination = MainTopLevelDestination.restore(
            savedInstanceState?.getString(STATE_TOP_LEVEL_DESTINATION),
        )
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        applyTopLevelContainerVisibility(currentTopLevelDestination)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)

        viewPager = binding.viewPager
        homeAdapter = HomeFragmentStateAdapter(this)
        viewPager.adapter = homeAdapter
        setupViewPage(viewPager)
        viewPager.offscreenPageLimit = 1

        drawerBackCallback = object : OnBackPressedCallback(false) {
            override fun handleOnBackPressed() {
                closeMainDrawer()
            }
        }
        onBackPressedDispatcher.addCallback(this, drawerBackCallback)

        setupHeaderBar()
        setupBottomNavigationBar()
        setupMiniPlayer()
        setupMainDrawer()
        observeSleepTimer()
        observeThirdPartyAccounts()
        observeSidebarMenu()
        applyInsets()
        applyLocalModeFromIntent(intent)
        if (isLocalMode()) {
            configManager.enterLocalMode()
        }

        applyWyProfileBackgroundFromLogin()

        startupCoordinator = MainStartupCoordinator(
            activity = this,
            configManager = configManager,
            startupSnapshotStore = startupSnapshotStore,
            directMessageCoordinator = directMessageCoordinator,
            isLocalMode = ::isLocalMode,
            showUnreadAnnouncements = { preloaded -> showUnreadAnnouncementsIfAny(preloaded) },
        ).also { coordinator ->
            coordinator.startIfNeeded(
                savedInstanceState = savedInstanceState,
                skipStartupNotices = intent.getStringExtra(EXTRA_SETTINGS_ACTION) == ACTION_SETTINGS_ANNOUNCEMENTS,
            )
        }

        loveManager.preloadFromDiskAsync()
        playlistCollectionManager.preloadIndexFromDiskAsync()
        if (!isLocalMode() && syncManager.state().loggedIn) {
            lifecycleScope.launch {
                syncManager.syncNow()
            }
        }
        listeningManager.onAppStarted()

        DownloadPathManager.createDownloadDirectory(
            DownloadPathManager.getDownloadPath(this)
        )

        startService(Intent(this, MusicService::class.java))

        handlePendingSettingsAction(intent)
        handlePendingScanLink(intent)
        showLocalModeNoticeIfNeeded()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyLocalModeFromIntent(intent)
        handlePendingSettingsAction(intent)
        handlePendingScanLink(intent)
        showLocalModeNoticeIfNeeded()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putString(STATE_TOP_LEVEL_DESTINATION, currentTopLevelDestination.savedValue)
        super.onSaveInstanceState(outState)
    }

    private fun applyLocalModeFromIntent(intent: Intent?) {
        val reason = intent?.getStringExtra(EXTRA_LOCAL_MODE_REASON)?.trim().orEmpty()
        if (reason.isNotEmpty()) localModeReason = reason
    }

    private fun isLocalMode(): Boolean = !localModeReason.isNullOrBlank()

    private fun showLocalModeNoticeIfNeeded() {
        localModeReason?.takeIf { it.isNotBlank() } ?: return
        binding.root.post {
            PmMessage.warning(this, R.string.main_local_mode_entered)
        }
    }

    private fun handlePendingSettingsAction(intent: Intent?) {
        val action = intent?.getStringExtra(EXTRA_SETTINGS_ACTION) ?: return
        intent.removeExtra(EXTRA_SETTINGS_ACTION)
        binding.root.post {
            when (action) {
                ACTION_SETTINGS_ANNOUNCEMENTS -> showPublicInformationDialog()
                ACTION_SETTINGS_CHECK_UPDATE -> showCheckUpdateDialog()
                ACTION_SETTINGS_ABOUT -> showAboutDialog()
            }
        }
    }

    private fun setupHeaderBar() {
        binding.menuButton.setOnClickListener { openMainDrawer() }
        binding.searchButton.setOnClickListener {
            SearchActivity.start(this)
            selectBottomNavigation(R.id.navSearchContainer)
        }

        binding.tabRecommendContainer.setOnClickListener {
            viewPager.setCurrentItem(0, true)
        }
        binding.tabFavoriteContainer.setOnClickListener {
            viewPager.setCurrentItem(1, true)
        }
        binding.tabPodcastContainer.setOnClickListener {
            viewPager.setCurrentItem(2, true)
        }

        val unsupportedTabContainers = listOf(
            binding.tabAudiobookContainer,
            binding.tabMidnightContainer,
        )
        unsupportedTabContainers.forEach { container ->
            container.setOnClickListener {
                PmMessage.info(this, R.string.main_channel_building)
            }
        }
    }

    private fun setupBottomNavigationBar() {
        binding.navHomeContainer.setOnClickListener {
            showHomeContent()
            viewPager.setCurrentItem(0, true)
        }
        binding.navSearchContainer.setOnClickListener {
            showHomeContent()
            selectBottomNavigation(R.id.navSearchContainer)
            SearchActivity.start(this)
        }
        binding.navNoteContainer.setOnClickListener {
            showDiscoverContent()
        }
        binding.navMineContainer.setOnClickListener {
            showMineContent()
        }
        when (currentTopLevelDestination) {
            MainTopLevelDestination.HOME -> showHomeContent()
            MainTopLevelDestination.DISCOVER -> showDiscoverContent()
            MainTopLevelDestination.MINE -> showMineContent()
        }
    }

    private fun showHomeContent() {
        currentTopLevelDestination = MainTopLevelDestination.HOME
        selectBottomNavigation(R.id.navHomeContainer)
        applyHomeTabSystemBarAppearance()
        applyTopLevelContainerVisibility(currentTopLevelDestination)
    }

    /**
     * 首页顶栏为浅色背景（或深色模式下为深底）：与 [MineFragment] 内根据滚动切换的状态栏样式区分开，
     * 从「我的」返回时必须按当前主题恢复，否则浅色主题下会残留白色状态栏图标。
     */
    private fun applyHomeTabSystemBarAppearance() {
        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.isAppearanceLightStatusBars = !isNight
        controller.isAppearanceLightNavigationBars = !isNight
    }

    private fun showMineContent() {
        currentTopLevelDestination = MainTopLevelDestination.MINE
        selectBottomNavigation(R.id.navMineContainer)
        applyTopLevelContainerVisibility(currentTopLevelDestination)

        var mineFragment = supportFragmentManager.findFragmentById(R.id.mineContainer) as? MineFragment
        if (mineFragment == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.mineContainer, MineFragment())
                .commitNowAllowingStateLoss()
            mineFragment = supportFragmentManager.findFragmentById(R.id.mineContainer) as? MineFragment
        }
        mineFragment?.restoreSystemBarStyleForCurrentHeader()
    }

    private fun showDiscoverContent() {
        currentTopLevelDestination = MainTopLevelDestination.DISCOVER
        selectBottomNavigation(R.id.navNoteContainer)
        applyTopLevelContainerVisibility(currentTopLevelDestination)

        var discoverFragment =
            supportFragmentManager.findFragmentById(R.id.discoverContainer) as? DiscoverFragment
        if (discoverFragment == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.discoverContainer, DiscoverFragment())
                .commitNowAllowingStateLoss()
            discoverFragment =
                supportFragmentManager.findFragmentById(R.id.discoverContainer) as? DiscoverFragment
        }
        discoverFragment?.restoreSystemBarStyle()
    }

    private fun applyTopLevelContainerVisibility(destination: MainTopLevelDestination) {
        val homeVisible = destination == MainTopLevelDestination.HOME
        binding.statusBarSpacer.visibility = if (homeVisible) View.VISIBLE else View.GONE
        binding.headerBar.visibility = if (homeVisible) View.VISIBLE else View.GONE
        binding.viewPager.visibility = if (homeVisible) View.VISIBLE else View.GONE
        binding.mineContainer.visibility =
            if (destination == MainTopLevelDestination.MINE) View.VISIBLE else View.GONE
        binding.discoverContainer.visibility =
            if (destination == MainTopLevelDestination.DISCOVER) View.VISIBLE else View.GONE
    }

    fun isMineContentActive(): Boolean =
        currentTopLevelDestination == MainTopLevelDestination.MINE

    fun isDiscoverContentActive(): Boolean =
        currentTopLevelDestination == MainTopLevelDestination.DISCOVER

    private fun setupMiniPlayer() {
        homeMiniPlayerBinder = HomeMiniPlayerBinder(this, binding.homeMiniPlayer, musicController).apply {
            setupClicks()
            startObserving(this@MainActivity)
        }
    }

    override fun onResume() {
        super.onResume()
        startupCoordinator?.onResume()
        drawerQuickActions?.refresh()
    }

    override fun onDestroy() {
        drawerDynamicMenusController?.destroy()
        drawerDynamicMenusController = null
        drawerQuickActions?.destroy()
        drawerQuickActions = null
        startupCoordinator?.onDestroy()
        startupCoordinator = null
        homeMiniPlayerBinder?.onDestroy()
        homeMiniPlayerBinder = null
        super.onDestroy()
    }

    private fun setupMainDrawer() {
        binding.mainDrawerScrim.setOnClickListener { closeMainDrawer() }
        binding.mainDrawerOverlay.dragListener = object : MainDrawerOverlayLayout.DragListener {
            override fun canDragDrawer(): Boolean =
                mainDrawerOpen && binding.mainDrawerOverlay.visibility == View.VISIBLE

            override fun onDrawerDragStart() {
                drawerDragStartTranslationX = binding.mainDrawerPanel.translationX
                cancelMainDrawerAnimations()
            }

            override fun onDrawerDragProgress(deltaX: Float) {
                val w = mainDrawerWidthPx.toFloat().coerceAtLeast(1f)
                val tx = (drawerDragStartTranslationX + deltaX).coerceIn(-w, 0f)
                binding.mainDrawerPanel.translationX = tx
                binding.mainDrawerScrimFull.alpha = MAIN_DRAWER_SCRIM_MAX_ALPHA * (1f + tx / w)
            }

            override fun onDrawerDragEnd(deltaX: Float, velocityX: Float) {
                val w = mainDrawerWidthPx.toFloat().coerceAtLeast(1f)
                val tx = (drawerDragStartTranslationX + deltaX).coerceIn(-w, 0f)
                val shouldClose = velocityX <= -drawerFlingVelocityThresholdPx || tx <= -w * 0.35f
                if (shouldClose) {
                    animateMainDrawerClose(currentTranslationX = tx)
                } else {
                    animateMainDrawerRestore(currentTranslationX = tx)
                }
            }
        }
        ensureDrawerContentInflated()
    }

    private fun ensureDrawerContentInflated(): MainDrawerContentBinding {
        drawerContentBinding?.let { return it }
        val inflated = MainDrawerContentBinding.inflate(layoutInflater, binding.mainDrawerPanel, true)
        inflated.drawerAccountRow.setOnClickListener {
            if (AccountSessionStore.read(this).loggedIn) {
                AccountProfileActivity.start(this)
            } else {
                LoginActivity.start(this)
            }
            closeMainDrawer()
        }
        inflated.drawerSettingsButton.setOnClickListener {
            SettingsActivity.start(this)
            closeMainDrawer()
        }
        inflated.drawerScanButton.setOnClickListener { startDrawerQrScan() }
        inflated.drawerFeedbackButton.setOnClickListener {
            FeedbackActivity.start(this)
            closeMainDrawer()
        }
        inflated.drawerImportPlaylistsRow.setOnClickListener {
            closeMainDrawer()
            ThirdPartyAccountsActivity.start(this)
        }
        inflated.drawerLinkImportRow.setOnClickListener {
            closeMainDrawer()
            PlaylistLinkImportDialog.show(this, wyCookieRepository, kgRepository)
        }
        inflated.drawerSleepTimerRow.setOnClickListener {
            closeMainDrawer()
            SleepTimerBottomSheet.show(this, sleepTimerManager)
        }
        drawerQuickActions = DrawerQuickActions(this, ::closeMainDrawer).apply {
            bind(inflated.drawerQuickActionsContainer)
        }
        drawerDynamicMenusController = DrawerDynamicMenusController(
            activity = this,
            binding = inflated,
            repository = sidebarMenuRepository,
            closeDrawer = ::closeMainDrawer,
        ).apply {
            render(sidebarMenuRepository.state.value)
        }
        drawerContentBinding = inflated
        bindDrawerAccountUi()
        bindDrawerThirdPartyUi()
        bindDrawerSleepTimer(sleepTimerManager.state.value)
        return inflated
    }

    private fun startDrawerQrScan() {
        closeMainDrawer()
        val options = ScanOptions().apply {
            setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            setPrompt(getString(R.string.drawer_scan_prompt))
            setBeepEnabled(false)
            setOrientationLocked(true)
            setCaptureActivity(PortraitCaptureActivity::class.java)
        }
        drawerScanLauncher.launch(options)
        AppActivityTransitions.applyForward(this)
    }

    private fun handlePendingScanLink(intent: Intent?) {
        val raw = intent?.getStringExtra(EXTRA_SCAN_LINK)?.trim().orEmpty()
        if (raw.isEmpty()) return
        intent?.removeExtra(EXTRA_SCAN_LINK)
        handleScanContent(raw)
    }

    private fun handleScanContent(raw: String) {
        when (val action = ListenTogetherScanLink.parse(raw)) {
            is ListenTogetherScanLink.Action.JoinRoom -> {
                PlayerActivity.startForListenTogetherJoin(this, action.roomId)
            }
            null -> {
                val share = ShareLink.parse(raw)
                if (share != null) {
                    ShareDetailActivity.start(this, share.uuid)
                } else {
                    PmMessage.warning(this, R.string.listen_together_scan_invalid)
                }
            }
        }
    }

    private fun bindDrawerAccountUi() {
        val b = drawerContentBinding ?: return
        val session = AccountSessionStore.read(this)
        if (!session.loggedIn) {
            b.drawerAccountTitle.setText(R.string.drawer_account_login_now)
            b.drawerAccountAvatar.setImageResource(R.drawable.ic_pm_icon)
            return
        }

        b.drawerAccountTitle.text = session.user.username
            .ifBlank { session.user.email }
            .ifBlank { getString(R.string.account_default_user) }
        val rawAvatar = session.user.avatarUrl.ifBlank { session.user.avatar }
        val avatarUrl = configManager.resolveSystemUrl(rawAvatar)
        if (avatarUrl == null) {
            b.drawerAccountAvatar.setImageResource(R.drawable.ic_pm_icon)
        } else {
            b.drawerAccountAvatar.load(avatarUrl) {
                transformations(CircleCropTransformation())
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
        }
    }

    private fun bindDrawerThirdPartyUi() {
        val b = drawerContentBinding ?: return
        val accounts = thirdPartyAccountsRepository.states.value
        fun valid(source: String) = accounts.any { it.source == source && it.loggedIn && it.validity == ThirdPartyLoginValidity.VALID }
        SongSourceTagBinder.bind(b.drawerKgSourceTag, SongType.KG, active = valid(MusicCookieManager.SOURCE_KG))
        SongSourceTagBinder.bind(b.drawerWySourceTag, SongType.WY, active = valid(MusicCookieManager.SOURCE_WY))
    }

    private fun observeThirdPartyAccounts() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                thirdPartyAccountsRepository.states.collect {
                    bindDrawerThirdPartyUi()
                    applyWyProfileBackgroundFromLogin()
                }
            }
        }
    }

    private fun observeSleepTimer() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                sleepTimerManager.state.collect(::bindDrawerSleepTimer)
            }
        }
    }

    private fun observeSidebarMenu() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                sidebarMenuRepository.state.collect { state ->
                    binding.menuRedDot.visibility = if (state.hasUnreadOnceRedDot) View.VISIBLE else View.GONE
                    drawerDynamicMenusController?.render(state)
                }
            }
        }
        if (!isLocalMode() && !configManager.hasFreshBootstrapInProcess()) {
            lifecycleScope.launch(Dispatchers.IO) {
                runCatching { configManager.refreshSidebarMenu() }
            }
        }
    }

    private fun bindDrawerSleepTimer(state: SleepTimerState) {
        val remainingView = drawerContentBinding?.drawerSleepTimerRemaining ?: return
        remainingView.visibility = if (state.active) View.VISIBLE else View.GONE
        if (state.waitingForSongEnd) {
            remainingView.setText(R.string.sleep_timer_drawer_waiting)
        } else if (state.enabled) {
            remainingView.text = SleepTimerRules.formatRemaining(state.remainingSeconds)
        }
    }

    private fun maybeRefreshDrawerProfilesAfterOpen() {
        drawerQuickActions?.refresh()
        bindDrawerAccountUi()
        bindDrawerThirdPartyUi()
        bindDrawerSleepTimer(sleepTimerManager.state.value)
        applyWyProfileBackgroundFromLogin()
    }

    /** 「我的」顶部背景图：与本地保存的网易云 `backgroundUrl` 一致。 */
    fun applyWyProfileBackgroundFromLogin() {
        val backgroundUrl = wyCookieRepository.getProfile()?.backgroundUrl
        val frag = supportFragmentManager.findFragmentById(R.id.mineContainer) as? MineFragment
        frag?.setWyProfileBackgroundUrl(backgroundUrl)
        frag?.applyMineAvatarDisplay()
        frag?.applyMineProfileTexts()
    }

    /** 进入「我的」时从本地登录态刷新顶部背景（无需先打开侧栏）。 */
    fun refreshMineProfileBackgroundFromLogin() {
        applyWyProfileBackgroundFromLogin()
    }

    /** 打开左侧抽屉（首页菜单、我的页左上角等可调用）。 */
    fun openMainDrawer() {
        if (mainDrawerOpen) return
        mainDrawerOpen = true
        drawerBackCallback.isEnabled = true
        cancelMainDrawerAnimations()
        ensureDrawerContentInflated()
        maybeRefreshDrawerProfilesAfterOpen()
        binding.mainDrawerOverlay.visibility = View.VISIBLE
        binding.mainDrawerScrimFull.alpha = 0f
        val w = mainDrawerWidthPx.toFloat()
        binding.mainDrawerPanel.translationX = -w
        binding.mainDrawerPanel.animate()
            .translationX(0f)
            .setDuration(260)
            .setInterpolator(DecelerateInterpolator())
            .start()
        binding.mainDrawerScrimFull.animate()
            .alpha(MAIN_DRAWER_SCRIM_MAX_ALPHA)
            .setDuration(240)
            .start()
    }

    /** 关闭抽屉（点遮罩、返回键或手势左滑）。 */
    fun closeMainDrawer() {
        if (!mainDrawerOpen) return
        animateMainDrawerClose(currentTranslationX = binding.mainDrawerPanel.translationX)
    }

    private fun animateMainDrawerClose(currentTranslationX: Float) {
        mainDrawerOpen = false
        drawerBackCallback.isEnabled = false
        cancelMainDrawerAnimations()
        val w = mainDrawerWidthPx.toFloat().coerceAtLeast(1f)
        val remainingRatio = ((w + currentTranslationX) / w).coerceIn(0f, 1f)
        val panelDuration = (220f * remainingRatio).toLong().coerceIn(80L, 220L)
        val scrimDuration = (200f * remainingRatio).toLong().coerceIn(80L, 200L)
        binding.mainDrawerPanel.animate()
            .translationX(-w)
            .setDuration(panelDuration)
            .setInterpolator(DecelerateInterpolator())
            .withEndAction {
                binding.mainDrawerOverlay.visibility = View.GONE
            }
            .start()
        binding.mainDrawerScrimFull.animate()
            .alpha(0f)
            .setDuration(scrimDuration)
            .start()
    }

    private fun animateMainDrawerRestore(currentTranslationX: Float) {
        cancelMainDrawerAnimations()
        val w = mainDrawerWidthPx.toFloat().coerceAtLeast(1f)
        val draggedRatio = (-currentTranslationX / w).coerceIn(0f, 1f)
        val duration = (220f * draggedRatio).toLong().coerceIn(80L, 220L)
        binding.mainDrawerPanel.animate()
            .translationX(0f)
            .setDuration(duration)
            .setInterpolator(DecelerateInterpolator())
            .start()
        binding.mainDrawerScrimFull.animate()
            .alpha(MAIN_DRAWER_SCRIM_MAX_ALPHA)
            .setDuration(duration)
            .start()
    }

    private fun cancelMainDrawerAnimations() {
        binding.mainDrawerPanel.clearAnimation()
        binding.mainDrawerScrimFull.clearAnimation()
        binding.mainDrawerPanel.animate().cancel()
        binding.mainDrawerScrimFull.animate().cancel()
    }

    private fun applyInsets() {
        binding.mainRoot.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.navigationBar.updatePadding(bottom = baseBottomNavPadding + insets.bottom)
            binding.mainDrawerPanel.updatePadding(
                top = insets.top,
                bottom = insets.bottom,
            )
        }
    }

    private fun setupViewPage(viewPager: ViewPager2) {
        viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                when (position) {
                    0 -> updateHeaderTabs(0)
                    1 -> updateHeaderTabs(1)
                    2 -> updateHeaderTabs(2)
                }
            }
        })
        updateHeaderTabs(0)
    }

    private fun updateHeaderTabs(selected: Int) {
        updateTabState(
            binding.tabRecommend,
            binding.tabRecommendUnderline,
            selected == 0,
        )
        updateTabState(
            binding.tabFavorite,
            binding.tabFavoriteUnderline,
            selected == 1,
        )
        updateTabState(
            binding.tabPodcast,
            binding.tabPodcastUnderline,
            selected == 2,
        )
        if (currentTopLevelDestination == MainTopLevelDestination.HOME) {
            selectBottomNavigation(R.id.navHomeContainer)
        }
    }

    private fun updateTabState(tab: TextView, underline: View, isSelected: Boolean) {
        val selectedColor = ContextCompat.getColor(this, R.color.home_tab_selected)
        val unselectedColor = ContextCompat.getColor(this, R.color.home_tab_unselected)
        tab.setTextColor(if (isSelected) selectedColor else unselectedColor)
        tab.alpha = 1f
        underline.visibility = if (isSelected) View.VISIBLE else View.INVISIBLE
        underline.setBackgroundColor(selectedColor)
    }

    private fun selectBottomNavigation(selectedContainerId: Int) {
        val selectedColor = ContextCompat.getColor(this, R.color.home_tab_selected)
        val unselectedColor = ContextCompat.getColor(this, R.color.home_tab_unselected)

        val navItems = listOf(
            Pair(binding.navHomeContainer.id, binding.navHomeLabel),
            Pair(binding.navSearchContainer.id, binding.navSearchLabel),
            Pair(binding.navNoteContainer.id, binding.navNoteLabel),
            Pair(binding.navMineContainer.id, binding.navMineLabel),
        )
        navItems.forEach { (containerId, label) ->
            val isSelected = containerId == selectedContainerId
            val color = if (isSelected) selectedColor else unselectedColor
            label.setTextColor(color)
            label.paint.isFakeBoldText = isSelected
        }
    }

    private fun showMoreMenu() {
        PopupMenu(this, binding.menuButton).apply {
            menuInflater.inflate(R.menu.drawer_menu, menu)
            setOnMenuItemClickListener { menuItem ->
                handleLegacyMenu(menuItem.itemId)
            }
            show()
        }
    }

    private fun handleLegacyMenu(itemId: Int): Boolean {
        return when (itemId) {
            R.id.nav_home -> {
                selectBottomNavigation(R.id.navHomeContainer)
                viewPager.setCurrentItem(0, true)
                true
            }

            R.id.nav_library -> {
                PmMessage.info(this, R.string.common_not_implemented)
                true
            }

            R.id.nav_local_music -> {
                LocalMusicActivity.start(this)
                true
            }

            R.id.nav_public_info -> {
                showPublicInformationDialog()
                true
            }

            R.id.nav_check_update -> {
                showCheckUpdateDialog()
                true
            }

            R.id.nav_settings -> {
                SettingsActivity.start(context = this)
                true
            }

            R.id.nav_about -> {
                showAboutDialog()
                true
            }

            else -> false
        }
    }

    fun downloadSong(songInfo: SongInfo) {
        onDownloadClick(songInfo)
    }

    /** 「我的」通知 / 原菜单「查看公告」 -> 打开最新公告弹窗 */
    fun showPublicInformationDialog() {
        lifecycleScope.launch {
            val response = systemRepository.getAnnouncements().getOrElse {
                PmMessage.error(this@MainActivity, R.string.page_announcement_load_failed)
                return@launch
            }
            if (!response.success || response.code != 0) {
                PmMessage.error(this@MainActivity, response.msg.ifBlank { getString(R.string.page_announcement_load_failed) })
                return@launch
            }
            val announcements = response.data
            if (announcements.isEmpty()) {
                PmMessage.info(this@MainActivity, R.string.announcement_empty)
                return@launch
            }
            val latest = announcements.first()
            showPublicInformationDialog(latest)
        }
    }

    private suspend fun showUnreadAnnouncementsIfAny(preloaded: List<AnnouncementItem>? = null) {
        val all = preloaded ?: run {
            val response = systemRepository.getAnnouncements().getOrElse { return }
            if (!response.success || response.code != 0) return
            response.data
        }
        if (all.isEmpty()) return

        val prefs = getSharedPreferences(APP_NOTICE_PREFS, Context.MODE_PRIVATE)
        val readIds = prefs.getStringSet(KEY_READ_ANNOUNCEMENT_IDS, emptySet()) ?: emptySet()
        val unread = all.filter { it.showEveryTime || !readIds.contains(it.id) }
        if (unread.isEmpty()) return

        // 规则 1：首页公告只弹出最新一条未读的公告，若公告是每次弹出的类型那么也要弹出
        val latest = unread.first()
        val confirmed = showPublicInformationDialog(latest)
        if (confirmed && !latest.showEveryTime) {
            val nextReadIds = (prefs.getStringSet(KEY_READ_ANNOUNCEMENT_IDS, emptySet()) ?: emptySet()).toMutableSet()
            nextReadIds.add(latest.id)
            prefs.edit().putStringSet(KEY_READ_ANNOUNCEMENT_IDS, nextReadIds).apply()
        }
    }

    private suspend fun showPublicInformationDialog(item: AnnouncementItem): Boolean = kotlinx.coroutines.suspendCancellableCoroutine { cont ->
        val sheet = AnnouncementDetailBottomSheet.show(
            activity = this,
            item = item,
            dismissible = false,
            onConfirmed = {
                lifecycleScope.launch(Dispatchers.IO) {
                    systemRepository.markAnnouncementRead(item.id)
                }
                if (cont.isActive) cont.resume(true, onCancellation = null)
            },
            onCancelled = { if (cont.isActive) cont.resume(false, onCancellation = null) },
        )
        cont.invokeOnCancellation { sheet.dismiss() }
    }

    /** 「我的」升级 / 原菜单「检查更新」 */
    fun showCheckUpdateDialog() {

    }

    /** 「我的」关于 / 原菜单「关于」 */
    fun showAboutDialog() {

    }

    /** 从首页功能卡进入共享音乐空间。 */
    fun openHomeCloudTab() {
        showHomeContent()
        viewPager.setCurrentItem(1, true)
    }

    companion object {
        private const val MAIN_DRAWER_SCRIM_MAX_ALPHA = 0.45f
        private const val STATE_TOP_LEVEL_DESTINATION = "main.top_level_destination"
        const val EXTRA_SETTINGS_ACTION = "cn.partialy.pm.extra.SETTINGS_ACTION"
        private const val EXTRA_LOCAL_MODE_REASON = "cn.partialy.pm.extra.LOCAL_MODE_REASON"
        private const val EXTRA_SCAN_LINK = "cn.partialy.pm.extra.SCAN_LINK"
        const val ACTION_SETTINGS_ANNOUNCEMENTS = "announcements"
        const val ACTION_SETTINGS_CHECK_UPDATE = "check_update"
        const val ACTION_SETTINGS_ABOUT = "about"

        private const val APP_NOTICE_PREFS = "app_notice_prefs"
        private const val KEY_READ_ANNOUNCEMENT_IDS = "read_announcement_ids"

        fun start(
            context: Context,
            localModeReason: String? = null,
            scanLink: String? = null,
        ) {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                if (!localModeReason.isNullOrBlank()) {
                    putExtra(EXTRA_LOCAL_MODE_REASON, localModeReason)
                }
                if (!scanLink.isNullOrBlank()) {
                    putExtra(EXTRA_SCAN_LINK, scanLink)
                }
            }
            context.startActivity(intent)
            (context as? Activity)?.overridePendingTransition(
                R.anim.from_scale_to_in,
                R.anim.scale_and_dim,
            )
        }
    }

}
