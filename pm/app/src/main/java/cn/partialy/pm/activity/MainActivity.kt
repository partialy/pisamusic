package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.widget.PopupMenu
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Space
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
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
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

        // 仅在首次创建时拉公告；避免深色模式等配置变更导致 Activity 重建后重复弹窗
        if (!isLocalMode() && savedInstanceState == null &&
            intent.getStringExtra(EXTRA_SETTINGS_ACTION) != ACTION_SETTINGS_ANNOUNCEMENTS
        ) {
            lifecycleScope.launch {
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
                ACTION_SETTINGS_ANNOUNCEMENTS -> lifecycleScope.launch { showUnreadAnnouncementsIfAny() }
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

    /** 「我的」通知 / 原菜单「查看公告」 */
    fun showPublicInformationDialog() {
        lifecycleScope.launch {
            showUnreadAnnouncementsIfAny()
        }
    }

    private suspend fun showUnreadAnnouncementsIfAny() {
        val response = systemRepository.getAnnouncements().getOrElse { return }
        if (!response.success || response.code != 0) return
        val all = response.data
        if (all.isEmpty()) return

        val prefs = getSharedPreferences(APP_NOTICE_PREFS, Context.MODE_PRIVATE)
        val readIds = prefs.getStringSet(KEY_READ_ANNOUNCEMENT_IDS, emptySet())?.toMutableSet() ?: mutableSetOf()
        val unread = all.filter { it.showEveryTime || !readIds.contains(it.id) }
        if (unread.isEmpty()) return

        for ((index, item) in unread.withIndex()) {
            val remaining = unread.size - index - 1
            val confirmed = showAnnouncementDialog(item, remaining)
            if (!confirmed) continue
            if (!item.showEveryTime) {
                readIds.add(item.id)
                prefs.edit().putStringSet(KEY_READ_ANNOUNCEMENT_IDS, readIds).apply()
            }
        }
    }

    private suspend fun showAnnouncementDialog(
        item: AnnouncementItem,
        remaining: Int,
    ): Boolean = suspendCoroutine { cont ->
        val positiveText = item.confirmText
        val sheet = BottomSheetDialog(this@MainActivity).apply {
            setContentView(R.layout.layout_announcement_bottom_sheet)
            setCancelable(false)
        }
        sheet.setOnShowListener {
            val bottomSheetView = sheet.findViewById<View>(
                com.google.android.material.R.id.design_bottom_sheet,
            ) ?: return@setOnShowListener
            bottomSheetView.layoutParams = bottomSheetView.layoutParams.apply {
                height = ViewGroup.LayoutParams.WRAP_CONTENT
            }
            BottomSheetBehavior.from(bottomSheetView as ViewGroup).apply {
                skipCollapsed = true
                isFitToContents = true
                isDraggable = false
                state = BottomSheetBehavior.STATE_EXPANDED
            }
            bottomSheetView.requestLayout()
        }

        val webView = sheet.findViewById<WebView>(R.id.announcementWebView)
        val confirmButton = sheet.findViewById<MaterialButton>(R.id.confirmButton)
        val gotoButton = sheet.findViewById<MaterialButton>(R.id.gotoButton)
        val spacer = sheet.findViewById<Space>(R.id.buttonSpacer)
        val sheetBackgroundColor = ContextCompat.getColor(this, R.color.modal_surface_background)
        val primaryColor = MaterialColors.getColor(
            this,
            com.google.android.material.R.attr.colorPrimary,
            ContextCompat.getColor(this, R.color.blue_selected),
        )
        val titleColor = MaterialColors.getColor(
            this,
            com.google.android.material.R.attr.colorOnSurface,
            ContextCompat.getColor(this, R.color.pm_dialog_title),
        )
        val bodyColor = ContextCompat.getColor(this, R.color.pm_dialog_message)

        webView?.apply {
            settings.javaScriptEnabled = false
            settings.domStorageEnabled = false
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            setBackgroundColor(sheetBackgroundColor)
            loadDataWithBaseURL(
                null,
                buildAnnouncementHtml(
                    item = item,
                    remaining = remaining,
                    backgroundColor = sheetBackgroundColor,
                    titleColor = titleColor,
                    bodyColor = bodyColor,
                    primaryColor = primaryColor,
                ),
                "text/html",
                "utf-8",
                null,
            )
        }

        confirmButton?.text = positiveText
        confirmButton?.setOnClickListener {
            if (!sheet.isShowing) return@setOnClickListener
            cont.resume(true)
            sheet.dismiss()
        }

        if (item.showGotoButton) {
            gotoButton?.visibility = View.VISIBLE
            spacer?.visibility = View.VISIBLE
            gotoButton?.setOnClickListener {
                if (!sheet.isShowing) return@setOnClickListener
                val url = item.gotoUrl?.trim().orEmpty()
                if (url.isNotEmpty()) {
                    val uri = Uri.parse(url)
                    val scheme = uri.scheme?.lowercase()
                    if (scheme == "http" || scheme == "https") {
                        WebContentActivity.start(this@MainActivity, url)
                    } else {
                        Toast.makeText(this@MainActivity, R.string.web_content_invalid_url, Toast.LENGTH_SHORT).show()
                    }
                }
                cont.resume(true)
                sheet.dismiss()
            }
        } else {
            gotoButton?.visibility = View.GONE
            spacer?.visibility = View.GONE
        }

        sheet.setOnCancelListener {
            cont.resume(false)
        }
        sheet.show()
    }

    private fun buildAnnouncementHtml(
        item: AnnouncementItem,
        remaining: Int,
        backgroundColor: Int,
        titleColor: Int,
        bodyColor: Int,
        primaryColor: Int,
    ): String {
        fun escape(input: String): String = input
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")

        fun cssColor(color: Int): String = String.format("#%06X", 0xFFFFFF and color)
        fun cssColorWithAlpha(color: Int, alpha: Float): String =
            "rgba(${android.graphics.Color.red(color)}, ${android.graphics.Color.green(color)}, " +
                "${android.graphics.Color.blue(color)}, $alpha)"

        val publisher = escape(item.publisher)
        val time = escape(item.time)
        val backgroundCss = cssColor(backgroundColor)
        val titleCss = cssColor(titleColor)
        val bodyCss = cssColor(bodyColor)
        val primaryCss = cssColor(primaryColor)
        val primaryBackgroundCss = cssColorWithAlpha(primaryColor, 0.14f)
        return """
            <!doctype html>
            <html lang="zh-CN">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
              <style>
                :root {
                  --bg: $backgroundCss;
                  --text-main: $bodyCss;
                  --text-sub: $bodyCss;
                  --title: $titleCss;
                  --accent-bg: $primaryBackgroundCss;
                  --accent: $primaryCss;
                }
                * { box-sizing: border-box; }
                html, body {
                  margin: 0;
                  padding: 0;
                  background: var(--bg);
                  color: var(--text-main);
                  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
                }
                .wrap { padding: 4px 4px 8px 4px; }
                .header { display: flex; align-items: center; margin-bottom: 14px; }
                .header-main { display: flex; align-items: center; min-width: 0; }
                .icon {
                  width: 40px; height: 40px; margin-right: 12px;
                  border-radius: 999px; display: flex; align-items: center; justify-content: center;
                  background: var(--accent-bg); color: var(--accent); flex-shrink: 0;
                }
                .title { font-size: 20px; font-weight: 700; color: var(--title); margin: 0; }
                .badge {
                  margin-left: auto;
                  min-width: 22px;
                  height: 22px;
                  padding: 0 7px;
                  border-radius: 999px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  font-weight: 700;
                  background: var(--accent);
                  color: #ffffff;
                  line-height: 1;
                }
                .content {
                  font-size: 14px;
                  line-height: 1.7;
                  color: var(--text-main);
                  margin-bottom: 14px;
                  word-break: break-word;
                }
                .content p { margin: 0 0 10px 0; color: var(--text-main); }
                .content ul { margin: 0 0 10px 18px; padding: 0; }
                .content li { margin: 0 0 6px 0; }
                .content strong { font-weight: 700; }
                .meta {
                  display: flex; justify-content: flex-end; gap: 10px;
                  font-size: 11px; color: var(--text-sub);
                }
              </style>
            </head>
            <body>
              <div class="wrap">
                <div class="header">
                  <div class="header-main">
                    <div class="icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <h3 class="title">${escape(getString(R.string.announcement_system_title))}</h3>
                  </div>
                  ${if (remaining > 0) "<span class=\"badge\">$remaining</span>" else ""}
                </div>
                <div class="content">${item.content}</div>
                <div class="meta">
                  <span>$publisher</span>
                  <span>$time</span>
                </div>
              </div>
            </body>
            </html>
        """.trimIndent()
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
