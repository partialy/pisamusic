package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
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
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.util.UnstableApi
import androidx.viewpager2.widget.ViewPager2
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseDownloadActivity
import cn.partialy.pm.databinding.ActivityMainBinding
import cn.partialy.pm.databinding.MainDrawerContentBinding
import cn.partialy.pm.model.AnnouncementItem
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.listen.ListenTogetherScanLink
import cn.partialy.pm.network.cookie.KugouCookieRepository
import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.repository.SystemRepository
import cn.partialy.pm.service.MusicService
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.ui.dialog.ModernDialog
import cn.partialy.pm.ui.discover.DiscoverFragment
import cn.partialy.pm.ui.home.HomeFragmentStateAdapter
import cn.partialy.pm.ui.home.HomeMiniPlayerBinder
import cn.partialy.pm.ui.mine.MineFragment
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.DownloadPathManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
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
    lateinit var kugouCookieRepository: KugouCookieRepository

    @Inject
    lateinit var wyCookieRepository: WyCookieRepository

    @Inject
    lateinit var musicCookieManager: MusicCookieManager

    @Inject
    lateinit var syncManager: SyncManager

    private lateinit var viewPager: ViewPager2
    private lateinit var homeAdapter: HomeFragmentStateAdapter
    private var favCount = 0
    private val baseBottomNavPadding by lazy { (resources.displayMetrics.density * 8).toInt() }
    private var homeMiniPlayerBinder: HomeMiniPlayerBinder? = null

    private var mainDrawerOpen = false
    private val mainDrawerWidthPx: Int
        get() = resources.getDimensionPixelSize(R.dimen.main_drawer_width)
    private lateinit var drawerBackCallback: OnBackPressedCallback

    private var drawerContentBinding: MainDrawerContentBinding? = null

    private var drawerMoreMenuVisible = false

    private var drawerPlaylistImportInProgress = false
    private var localModeReason: String? = null

    private data class DrawerPlaylistImportSummary(
        val added: Int,
        val skipped: Int,
    )

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
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        enableEdgeToEdgeSystemBars(lightStatusBarIcons = true, lightNavigationBarIcons = true)

        viewPager = binding.viewPager
        homeAdapter = HomeFragmentStateAdapter(this)
        viewPager.adapter = homeAdapter
        setupViewPage(viewPager)
        viewPager.offscreenPageLimit = 1

        drawerBackCallback = object : OnBackPressedCallback(false) {
            override fun handleOnBackPressed() {
                if (drawerMoreMenuVisible) {
                    hideDrawerMoreMenu()
                } else {
                    closeMainDrawer()
                }
            }
        }
        onBackPressedDispatcher.addCallback(this, drawerBackCallback)

        setupHeaderBar()
        setupBottomNavigationBar()
        setupMiniPlayer()
        setupMainDrawer()
        applyInsets()
        applyLocalModeFromIntent(intent)

        applyWyProfileBackgroundFromLogin()

        if (!isLocalMode()) {
            lifecycleScope.launch {
                kgRepository.updateUrl()
            }
        }

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

    private fun applyLocalModeFromIntent(intent: Intent?) {
        val reason = intent?.getStringExtra(EXTRA_LOCAL_MODE_REASON)?.trim().orEmpty()
        if (reason.isNotEmpty()) localModeReason = reason
    }

    private fun isLocalMode(): Boolean = !localModeReason.isNullOrBlank()

    private fun showLocalModeNoticeIfNeeded() {
        localModeReason?.takeIf { it.isNotBlank() } ?: return
        binding.root.post {
            Toast.makeText(this, "当前无网络或服务不可用，已进入本地模式", Toast.LENGTH_SHORT).show()
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
                Toast.makeText(this, "该频道正在建设中", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupBottomNavigationBar() {
        binding.navHomeContainer.setOnClickListener {
            selectBottomNavigation(R.id.navHomeContainer)
            showHomeContent()
            viewPager.setCurrentItem(0, true)
        }
        binding.navSearchContainer.setOnClickListener {
            selectBottomNavigation(R.id.navSearchContainer)
            showHomeContent()
            SearchActivity.start(this)
        }
        binding.navNoteContainer.setOnClickListener {
            selectBottomNavigation(R.id.navNoteContainer)
            showDiscoverContent()
        }
        binding.navMineContainer.setOnClickListener {
            selectBottomNavigation(R.id.navMineContainer)
            showMineContent()
        }
        selectBottomNavigation(R.id.navHomeContainer)
        showHomeContent()
    }

    private fun showHomeContent() {
        applyHomeTabSystemBarAppearance()
        binding.statusBarSpacer.visibility = View.VISIBLE
        binding.headerBar.visibility = View.VISIBLE
        binding.viewPager.visibility = View.VISIBLE
        binding.mineContainer.visibility = View.GONE
        binding.discoverContainer.visibility = View.GONE
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
        binding.statusBarSpacer.visibility = View.GONE
        binding.headerBar.visibility = View.GONE
        binding.viewPager.visibility = View.GONE
        binding.discoverContainer.visibility = View.GONE
        binding.mineContainer.visibility = View.VISIBLE

        if (supportFragmentManager.findFragmentById(R.id.mineContainer) == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.mineContainer, MineFragment())
                .commitNowAllowingStateLoss()
        }
    }

    private fun showDiscoverContent() {
        binding.statusBarSpacer.visibility = View.GONE
        binding.headerBar.visibility = View.GONE
        binding.viewPager.visibility = View.GONE
        binding.mineContainer.visibility = View.GONE
        binding.discoverContainer.visibility = View.VISIBLE

        if (supportFragmentManager.findFragmentById(R.id.discoverContainer) == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.discoverContainer, DiscoverFragment())
                .commitNowAllowingStateLoss()
        }
    }

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
        inflated.drawerScanButton.setOnClickListener { startDrawerQrScan() }
        inflated.drawerCloseButton.setOnClickListener { closeMainDrawer() }
        drawerContentBinding = inflated
        setupDrawerFooterActions(inflated)
        setupDrawerThirdPartyActions(inflated)
        bindMainDrawerAccountUi()
        return inflated
    }

    private fun startDrawerQrScan() {
        hideDrawerMoreMenu()
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
            null -> Toast.makeText(
                this,
                R.string.listen_together_scan_invalid,
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    private fun setupDrawerThirdPartyActions(b: MainDrawerContentBinding) {
        b.drawerImportPlaylistsButton.setOnClickListener {
            importLoggedInPlaylistsFromDrawer()
        }
        b.drawerLogoutThirdPartyButton.setOnClickListener {
            logoutThirdPartyFromDrawer()
        }
    }

    private fun importLoggedInPlaylistsFromDrawer() {
        if (drawerPlaylistImportInProgress) return
        val sources = listOf(MusicCookieManager.SOURCE_KG, MusicCookieManager.SOURCE_WY)
            .filter { musicCookieManager.getCookie(it).exist }
        if (sources.isEmpty()) {
            Toast.makeText(this, R.string.drawer_import_kg_need_login, Toast.LENGTH_SHORT).show()
            return
        }
        drawerPlaylistImportInProgress = true
        setDrawerThirdPartyActionsEnabled(false)
        Toast.makeText(this, R.string.drawer_import_all_running, Toast.LENGTH_SHORT).show()
        closeMainDrawer()
        lifecycleScope.launch {
            var added = 0
            var skipped = 0
            var failed = false
            try {
                val summaries = withContext(Dispatchers.IO) {
                    sources.map { source ->
                        when (source) {
                            MusicCookieManager.SOURCE_KG -> importKgPlaylistsForLoggedInSource()
                            MusicCookieManager.SOURCE_WY -> importWyPlaylistsForLoggedInSource()
                            else -> null
                        }
                    }
                }
                for (summary in summaries) {
                    if (summary == null) {
                        failed = true
                    } else {
                        added += summary.added
                        skipped += summary.skipped
                    }
                }
                val message = if (failed) {
                    getString(R.string.drawer_import_all_failed)
                } else {
                    getString(R.string.drawer_import_all_done, added, skipped)
                }
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_LONG).show()
            } finally {
                drawerPlaylistImportInProgress = false
                setDrawerThirdPartyActionsEnabled(true)
            }
        }
    }

    private suspend fun importKgPlaylistsForLoggedInSource(): DrawerPlaylistImportSummary? {
        val items = kugouCookieRepository.fetchAllUserPlaylists().getOrNull() ?: return null
        var added = 0
        var skipped = 0
        for (item in items) {
            val id = item.globalCollectionId?.takeIf { it.isNotBlank() }
                ?: item.listid?.takeIf { it > 0 }?.toString()
                ?: continue
            val name = item.name?.trim()?.takeIf { it.isNotEmpty() } ?: continue
            val rawCover = item.pic?.takeIf { it.isNotBlank() }
                ?: item.createUserPic?.takeIf { it.isNotBlank() }
                ?: ""
            val cover = rawCover.replace("{size}", "240")
            val count = item.count ?: 0
            val cp = CollectedPlaylist(
                type = CollectedPlaylistType.IMPORT_KG,
                id = id,
                name = name,
                intro = "",
                cover = cover,
                count = count,
            )
            if (playlistCollectionManager.addNetworkPlaylist(cp)) {
                added++
            } else {
                skipped++
            }
        }
        return DrawerPlaylistImportSummary(added, skipped)
    }

    private suspend fun importWyPlaylistsForLoggedInSource(): DrawerPlaylistImportSummary? {
        val uid = wyCookieRepository.getProfile()?.userId?.toLongOrNull() ?: return null
        val items = wyCookieRepository.fetchAllUserPlaylists(uid).getOrNull() ?: return null
        var added = 0
        var skipped = 0
        for (item in items) {
            val id = item.id?.takeIf { it > 0 }?.toString() ?: continue
            val name = item.name?.trim()?.takeIf { it.isNotEmpty() } ?: continue
            val cover = item.coverImgUrl?.trim().orEmpty()
            val count = item.trackCount ?: 0
            val intro = item.description?.trim().orEmpty()
            val cp = CollectedPlaylist(
                type = CollectedPlaylistType.IMPORT_WY,
                id = id,
                name = name,
                intro = intro,
                cover = cover,
                count = count,
            )
            if (playlistCollectionManager.addNetworkPlaylist(cp)) {
                added++
            } else {
                skipped++
            }
        }
        return DrawerPlaylistImportSummary(added, skipped)
    }

    private fun logoutThirdPartyFromDrawer() {
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                musicCookieManager.clearAll()
            }
            bindMainDrawerAccountUi()
            applyWyProfileBackgroundFromLogin()
            Toast.makeText(this@MainActivity, R.string.drawer_logout_third_party_done, Toast.LENGTH_SHORT).show()
            closeMainDrawer()
        }
    }

    private fun setDrawerThirdPartyActionsEnabled(enabled: Boolean) {
        drawerContentBinding?.drawerImportPlaylistsButton?.isEnabled = enabled
        drawerContentBinding?.drawerLogoutThirdPartyButton?.isEnabled = enabled
    }

    private fun setupDrawerFooterActions(b: MainDrawerContentBinding) {
        b.drawerSettingsButton.setOnClickListener {
            SettingsActivity.start(this)
            closeMainDrawer()
        }
        b.drawerMoreButton.setOnClickListener {
            if (drawerMoreMenuVisible) hideDrawerMoreMenu() else showDrawerMoreMenu()
        }
        b.drawerMoreRowKg.setOnClickListener {
            hideDrawerMoreMenu()
            PlaylistImportActivity.start(this, SongType.KG)
            closeMainDrawer()
        }
        b.drawerMoreRowWyWeb.setOnClickListener {
            hideDrawerMoreMenu()
            WyWebPlaylistLoginActivity.start(this)
            closeMainDrawer()
        }
        b.drawerMoreRowWyApi.setOnClickListener {
            hideDrawerMoreMenu()
            WyPlaylistLoginActivity.start(this)
            closeMainDrawer()
        }
    }

    private fun showDrawerMoreMenu() {
        val b = drawerContentBinding ?: return
        drawerMoreMenuVisible = true
        b.drawerMoreMenuCard.visibility = View.VISIBLE
    }

    private fun hideDrawerMoreMenu() {
        if (!drawerMoreMenuVisible) return
        drawerMoreMenuVisible = false
        drawerContentBinding?.drawerMoreMenuCard?.visibility = View.GONE
    }

    private fun bindMainDrawerAccountUi() {
        val b = drawerContentBinding ?: return
        val notLogged = getString(R.string.drawer_not_logged_in)
        val kgCookie = musicCookieManager.getCookie(MusicCookieManager.SOURCE_KG)
        val wyCookie = musicCookieManager.getCookie(MusicCookieManager.SOURCE_WY)
        val kgProfile = kugouCookieRepository.getProfile()
        val wyProfile = wyCookieRepository.getProfile()
        val hasAnyThirdPartyLogin = kgCookie.exist || wyCookie.exist

        b.drawerThirdPartyActionBar.visibility = if (hasAnyThirdPartyLogin) View.VISIBLE else View.GONE

        if (!kgCookie.exist) {
            b.drawerKgNickname.text = notLogged
            b.drawerKgAvatar.setImageResource(R.drawable.ic_pm_icon)
        } else {
            b.drawerKgNickname.text = kgProfile?.nickname?.takeIf { it.isNotBlank() }
                ?: kgProfile?.username?.takeIf { it.isNotBlank() }
                ?: "酷狗用户"
            val kgUrl = kgProfile?.avatarUrl?.takeIf { it.isNotBlank() }
            if (kgUrl != null) {
                b.drawerKgAvatar.load(kgUrl) {
                    transformations(CircleCropTransformation())
                    placeholder(R.drawable.ic_pm_icon)
                    error(R.drawable.ic_pm_icon)
                }
            } else {
                b.drawerKgAvatar.setImageResource(R.drawable.ic_pm_icon)
            }
        }

        if (!wyCookie.exist) {
            b.drawerWyNickname.text = notLogged
            b.drawerWyAvatar.setImageResource(R.drawable.ic_pm_icon)
        } else {
            b.drawerWyNickname.text = wyProfile?.nickname?.takeIf { it.isNotBlank() }
                ?: wyProfile?.username?.takeIf { it.isNotBlank() }
                ?: "网易用户"
            val wyUrl = wyProfile?.avatarUrl?.takeIf { it.isNotBlank() }
            if (wyUrl != null) {
                b.drawerWyAvatar.load(wyUrl) {
                    transformations(CircleCropTransformation())
                    placeholder(R.drawable.ic_pm_icon)
                    error(R.drawable.ic_pm_icon)
                }
            } else {
                b.drawerWyAvatar.setImageResource(R.drawable.ic_pm_icon)
            }
        }
    }

    private fun bindPisaAccountUi() {
        val b = drawerContentBinding ?: return
        val session = AccountSessionStore.read(this)
        if (session.loggedIn) {
            b.drawerAccountTitle.text = session.user.username.ifBlank { "PisaMusic 用户" }
            b.drawerAccountSubtitle.text = session.user.email.ifBlank { "已登录，收藏与歌单会自动同步" }
        } else {
            b.drawerAccountTitle.text = "登录 / 注册"
            b.drawerAccountSubtitle.text = "账号登录后自动同步收藏与歌单"
        }
        b.drawerAccountAvatar.setImageResource(R.drawable.ic_pm_icon)
    }

    private fun maybeRefreshDrawerProfilesAfterOpen() {
        bindMainDrawerAccountUi()
        bindPisaAccountUi()
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
        hideDrawerMoreMenu()
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
                    1 -> {
                        updateHeaderTabs(1)
                        refreshFavoriteIfNeed()
                    }
                    2 -> updateHeaderTabs(2)
                }
            }
        })
        updateHeaderTabs(0)
    }

    private fun refreshFavoriteIfNeed() {
        val listCount = loveManager.getLoveList().size
        if (favCount == listCount) {
            return
        }
        favCount = listCount
        val current = viewPager.currentItem
        homeAdapter = HomeFragmentStateAdapter(this)
        viewPager.adapter = homeAdapter
        viewPager.setCurrentItem(current, false)
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
        selectBottomNavigation(R.id.navHomeContainer)
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
                Toast.makeText(this, "暂未实现", Toast.LENGTH_SHORT).show()
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

        webView?.apply {
            settings.javaScriptEnabled = false
            settings.domStorageEnabled = false
            isVerticalScrollBarEnabled = true
            isHorizontalScrollBarEnabled = false
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            val dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
            setBackgroundColor(if (dark) Color.parseColor("#17191d") else Color.WHITE)
            loadDataWithBaseURL(null, buildAnnouncementHtml(item, remaining), "text/html", "utf-8", null)
        }

        confirmButton?.text = positiveText
        if ((resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES) {
            confirmButton?.setTextColor(Color.WHITE)
            gotoButton?.setTextColor(Color.WHITE)
            gotoButton?.strokeColor = ColorStateList.valueOf(Color.parseColor("#4b5563"))
            sheet.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
                ?.setBackgroundColor(Color.parseColor("#17191d"))
        }
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

    private fun buildAnnouncementHtml(item: AnnouncementItem, remaining: Int): String {
        fun escape(input: String): String = input
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")

        val publisher = escape(item.publisher)
        val time = escape(item.time)
        return """
            <!doctype html>
            <html lang="zh-CN">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
              <style>
                :root {
                  --bg: #ffffff;
                  --text-main: #0f172a;
                  --text-sub: #64748b;
                  --title: #0f172a;
                  --accent-bg: rgba(14, 165, 233, 0.12);
                  --accent: #0ea5e9;
                }
                @media (prefers-color-scheme: dark) {
                  :root {
                    --bg: #17191d;
                    --text-main: #e2e8f0;
                    --text-sub: #94a3b8;
                    --title: #f8fafc;
                    --accent-bg: rgba(14, 165, 233, 0.2);
                    --accent: #38bdf8;
                  }
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
                    <h3 class="title">系统公告</h3>
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

    /** 首页顶栏与 ViewPager 切到「我喜欢」页（猜你喜欢卡片）。 */
    fun openHomeFavoriteTab() {
        viewPager.setCurrentItem(1, true)
        updateHeaderTabs(1)
    }

    companion object {
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
