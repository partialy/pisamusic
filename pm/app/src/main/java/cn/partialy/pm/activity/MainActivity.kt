package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.PopupMenu
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import android.widget.Toast
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
import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.repository.SystemRepository
import cn.partialy.pm.service.MusicService
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.ui.dialog.ModernDialog
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
    lateinit var wyCookieRepository: WyCookieRepository

    @Inject
    lateinit var musicCookieManager: MusicCookieManager

    @Inject
    lateinit var syncManager: SyncManager

    @Inject
    lateinit var listeningManager: ListeningManager

    @Inject
    lateinit var directMessageCoordinator: DirectMessageCoordinator

    @Inject
    lateinit var sleepTimerManager: SleepTimerManager

    private lateinit var viewPager: ViewPager2
    private lateinit var homeAdapter: HomeFragmentStateAdapter
    private val baseBottomNavPadding by lazy { (resources.displayMetrics.density * 8).toInt() }
    private var homeMiniPlayerBinder: HomeMiniPlayerBinder? = null

    private var mainDrawerOpen = false
    private val mainDrawerWidthPx: Int
        get() = resources.getDimensionPixelSize(R.dimen.main_drawer_width)
    private lateinit var drawerBackCallback: OnBackPressedCallback

    private var drawerContentBinding: MainDrawerContentBinding? = null

    private var localModeReason: String? = null
    private var currentTopLevelDestination = MainTopLevelDestination.HOME

    private val drawerScanLauncher = registerForActivityResult(ScanContract()) { result ->
        val contents = result.contents
        if (contents.isNullOrBlank()) {
            Toast.makeText(this, R.string.drawer_scan_cancelled, Toast.LENGTH_SHORT).show()
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
        applyInsets()
        applyLocalModeFromIntent(intent)

        applyWyProfileBackgroundFromLogin()

        // 仅在首次创建时拉远程消息；先展示专属消息，队列结束后再展示公告，避免两个弹窗重叠。
        if (!isLocalMode() && savedInstanceState == null &&
            intent.getStringExtra(EXTRA_SETTINGS_ACTION) != ACTION_SETTINGS_ANNOUNCEMENTS
        ) {
            lifecycleScope.launch {
                directMessageCoordinator.checkAndShow(this@MainActivity, DirectMessageCheckSource.STARTUP)
                showUnreadAnnouncementsIfAny()
            }
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
            Toast.makeText(this, R.string.main_local_mode_entered, Toast.LENGTH_SHORT).show()
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
                Toast.makeText(this, R.string.main_channel_building, Toast.LENGTH_SHORT).show()
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

    override fun onDestroy() {
        homeMiniPlayerBinder?.onDestroy()
        homeMiniPlayerBinder = null
        super.onDestroy()
    }

    private fun setupMainDrawer() {
        binding.mainDrawerScrim.setOnClickListener { closeMainDrawer() }
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
        inflated.drawerKgAccountEntry.setOnClickListener {
            if (!musicCookieManager.getCookie(MusicCookieManager.SOURCE_KG).exist) {
                PlaylistImportActivity.start(this, SongType.KG)
                closeMainDrawer()
            }
        }
        inflated.drawerWyAccountEntry.setOnClickListener {
            if (!musicCookieManager.getCookie(MusicCookieManager.SOURCE_WY).exist) {
                WyWebPlaylistLoginActivity.start(this)
                closeMainDrawer()
            }
        }
        inflated.drawerClearThirdPartyLogin.setOnClickListener {
            clearThirdPartyLoginFromDrawer()
        }
        inflated.drawerSleepTimerRow.setOnClickListener {
            closeMainDrawer()
            SleepTimerBottomSheet.show(this, sleepTimerManager)
        }
        SongSourceTagBinder.bind(inflated.drawerKgSourceTag, SongType.KG)
        SongSourceTagBinder.bind(inflated.drawerWySourceTag, SongType.WY)
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
                    Toast.makeText(
                        this,
                        R.string.listen_together_scan_invalid,
                        Toast.LENGTH_SHORT,
                    ).show()
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
        val kgLoggedIn = musicCookieManager.getCookie(MusicCookieManager.SOURCE_KG).exist
        val wyLoggedIn = musicCookieManager.getCookie(MusicCookieManager.SOURCE_WY).exist
        val kgProfile = musicCookieManager.getProfile(MusicCookieManager.SOURCE_KG)
        val wyProfile = musicCookieManager.getProfile(MusicCookieManager.SOURCE_WY)
        val hasAnyLogin = kgLoggedIn || wyLoggedIn

        b.drawerKgAccountEntry.isClickable = !kgLoggedIn
        b.drawerKgAccountEntry.isFocusable = !kgLoggedIn
        b.drawerKgChevron.visibility = if (kgLoggedIn) View.GONE else View.VISIBLE
        b.drawerKgAvatar.visibility = if (kgLoggedIn) View.VISIBLE else View.GONE
        if (kgLoggedIn) {
            b.drawerKgNickname.text = kgProfile?.nickname?.takeIf(String::isNotBlank)
                ?: kgProfile?.username?.takeIf(String::isNotBlank)
                ?: getString(R.string.account_kg_default_user)
            val avatarUrl = kgProfile?.avatarUrl?.takeIf(String::isNotBlank)
            if (avatarUrl == null) {
                b.drawerKgAvatar.setImageResource(R.drawable.ic_pm_icon)
            } else {
                b.drawerKgAvatar.load(avatarUrl) {
                    transformations(CircleCropTransformation())
                    placeholder(R.drawable.ic_pm_icon)
                    error(R.drawable.ic_pm_icon)
                }
            }
        } else {
            b.drawerKgNickname.setText(R.string.drawer_not_logged_in)
            b.drawerKgAvatar.setImageResource(R.drawable.ic_pm_icon)
        }

        b.drawerWyAccountEntry.isClickable = !wyLoggedIn
        b.drawerWyAccountEntry.isFocusable = !wyLoggedIn
        b.drawerWyChevron.visibility = if (wyLoggedIn) View.GONE else View.VISIBLE
        b.drawerWyAvatar.visibility = if (wyLoggedIn) View.VISIBLE else View.GONE
        if (wyLoggedIn) {
            b.drawerWyNickname.text = wyProfile?.nickname?.takeIf(String::isNotBlank)
                ?: wyProfile?.username?.takeIf(String::isNotBlank)
                ?: getString(R.string.account_wy_default_user)
            val avatarUrl = wyProfile?.avatarUrl?.takeIf(String::isNotBlank)
            if (avatarUrl == null) {
                b.drawerWyAvatar.setImageResource(R.drawable.ic_pm_icon)
            } else {
                b.drawerWyAvatar.load(avatarUrl) {
                    transformations(CircleCropTransformation())
                    placeholder(R.drawable.ic_pm_icon)
                    error(R.drawable.ic_pm_icon)
                }
            }
        } else {
            b.drawerWyNickname.setText(R.string.drawer_not_logged_in)
            b.drawerWyAvatar.setImageResource(R.drawable.ic_pm_icon)
        }

        b.drawerImportPlaylistsTitle.setText(
            if (hasAnyLogin) {
                R.string.drawer_import_playlists
            } else {
                R.string.drawer_import_playlists_login_required
            },
        )
        b.drawerClearThirdPartyLogin.visibility = if (hasAnyLogin) View.VISIBLE else View.GONE
    }

    private fun clearThirdPartyLoginFromDrawer() {
        val clearButton = drawerContentBinding?.drawerClearThirdPartyLogin ?: return
        if (!clearButton.isEnabled) return
        clearButton.isEnabled = false
        lifecycleScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    musicCookieManager.clearAll()
                }
                bindDrawerThirdPartyUi()
                applyWyProfileBackgroundFromLogin()
                Toast.makeText(
                    this@MainActivity,
                    R.string.drawer_clear_third_party_login_done,
                    Toast.LENGTH_SHORT,
                ).show()
            } finally {
                clearButton.isEnabled = true
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
            .alpha(0.45f)
            .setDuration(240)
            .start()
    }

    /** 关闭抽屉（点遮罩或返回键）。 */
    fun closeMainDrawer() {
        if (!mainDrawerOpen) return
        mainDrawerOpen = false
        drawerBackCallback.isEnabled = false
        cancelMainDrawerAnimations()
        val w = mainDrawerWidthPx.toFloat()
        binding.mainDrawerPanel.animate()
            .translationX(-w)
            .setDuration(220)
            .setInterpolator(DecelerateInterpolator())
            .withEndAction {
                binding.mainDrawerOverlay.visibility = View.GONE
            }
            .start()
        binding.mainDrawerScrimFull.animate()
            .alpha(0f)
            .setDuration(200)
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
                Toast.makeText(this, R.string.common_not_implemented, Toast.LENGTH_SHORT).show()
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
                showMessage(getString(R.string.page_announcement_load_failed))
                return@launch
            }
            if (!response.success || response.code != 0) {
                showMessage(response.msg.ifBlank { getString(R.string.page_announcement_load_failed) })
                return@launch
            }
            val announcements = response.data
            if (announcements.isEmpty()) {
                showMessage(getString(R.string.announcement_empty))
                return@launch
            }
            val latest = announcements.first()
            showPublicInformationDialog(latest)
        }
    }

    private suspend fun showUnreadAnnouncementsIfAny() {
        val response = systemRepository.getAnnouncements().getOrElse { return }
        if (!response.success || response.code != 0) return
        val all = response.data
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
            onConfirmed = { if (cont.isActive) cont.resume(true, onCancellation = null) },
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
