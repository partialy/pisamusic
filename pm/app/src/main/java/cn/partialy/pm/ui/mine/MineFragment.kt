package cn.partialy.pm.ui.mine

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Typeface
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.fragment.app.Fragment
import androidx.viewpager2.widget.ViewPager2
import cn.partialy.pm.R
import cn.partialy.pm.activity.AccountProfileActivity
import cn.partialy.pm.activity.LoginActivity
import cn.partialy.pm.activity.MainActivity
import cn.partialy.pm.activity.SearchActivity
import cn.partialy.pm.databinding.FragmentMineBinding
import cn.partialy.pm.model.AccountUser
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import coil.load
import coil.transform.CircleCropTransformation
import com.google.android.material.appbar.AppBarLayout
import com.google.android.material.color.MaterialColors
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MineFragment : Fragment() {

    @Inject lateinit var configManager: ConfigManager

    private var _binding: FragmentMineBinding? = null
    private val binding get() = _binding!!
    private var appBarOffsetListener: AppBarLayout.OnOffsetChangedListener? = null
    private var pageChangeCallback: ViewPager2.OnPageChangeCallback? = null
    private var currentHeaderAlpha = 0f

    /** 与侧栏缓存的网易云 `backgroundUrl` 同步（无 URL 时用默认头图）。 */
    fun setWyProfileBackgroundUrl(url: String?) {
        val b = _binding ?: return
        if (url.isNullOrBlank()) {
            b.profileBgImageView.setImageResource(R.drawable.bg_mine_header)
        } else {
            b.profileBgImageView.load(url) {
                placeholder(R.drawable.bg_mine_header)
                error(R.drawable.bg_mine_header)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        (activity as? MainActivity)?.refreshMineProfileBackgroundFromLogin()
        applyMineProfileTexts()
        applyMineAvatarDisplay()
        if ((activity as? MainActivity)?.isMineContentActive() == true) {
            restoreSystemBarStyleForCurrentHeader()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentMineBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onDestroyView() {
        appBarOffsetListener?.let { binding.mineAppBar.removeOnOffsetChangedListener(it) }
        appBarOffsetListener = null
        pageChangeCallback?.let(binding.mineTabViewPager::unregisterOnPageChangeCallback)
        pageChangeCallback = null
        binding.mineTabViewPager.adapter = null
        ViewCompat.setOnApplyWindowInsetsListener(binding.root, null)
        super.onDestroyView()
        _binding = null
    }

    @SuppressLint("ResourceAsColor")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupInsets(view)

        binding.mineMenuButton.setOnClickListener {
            (activity as? MainActivity)?.openMainDrawer()
        }
        binding.mineSearchButton.setOnClickListener {
            SearchActivity.start(requireActivity())
        }

        binding.avatarImageView.setOnClickListener { openAccountEntry() }

        applyMineProfileTexts()

        val triggerPx = (200f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
        appBarOffsetListener = AppBarLayout.OnOffsetChangedListener { _, verticalOffset ->
            val scrollY = -verticalOffset
            currentHeaderAlpha = (scrollY.toFloat() / triggerPx).coerceIn(0f, 1f)
            binding.mineHeaderBg.alpha = currentHeaderAlpha
            applyStatusBarIconStyle(currentHeaderAlpha)

            val iconTint = if (currentHeaderAlpha < 0.5f) {
                android.R.color.white
            } else {
                R.color.colorOnBgNormal
            }
            binding.titleText.visibility = if (currentHeaderAlpha < 0.9f) View.GONE else View.VISIBLE
            val color = requireContext().getColor(iconTint)
            binding.mineMenuButton.setColorFilter(color)
            binding.mineSearchButton.setColorFilter(color)
            binding.titleText.setTextColor(requireContext().getColor(R.color.colorOnBgNormal))
        }
        appBarOffsetListener?.let(binding.mineAppBar::addOnOffsetChangedListener)

        binding.mineHeaderBg.alpha = 0f
        applyStatusBarIconStyle(0f)
        run {
            val color = requireContext().getColor(android.R.color.white)
            binding.mineMenuButton.setColorFilter(color)
            binding.mineSearchButton.setColorFilter(color)
        }

        binding.mineTabViewPager.adapter = MineTabPagerAdapter(this)
        binding.mineTabViewPager.offscreenPageLimit = 1
        pageChangeCallback = object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                applyMineTabStyle(position)
            }
        }
        pageChangeCallback?.let(binding.mineTabViewPager::registerOnPageChangeCallback)
        applyMineTabStyle(0)

        binding.tabMineText.setOnClickListener {
            binding.mineTabViewPager.setCurrentItem(0, true)
        }
        binding.tabPlaylistsText.setOnClickListener {
            binding.mineTabViewPager.setCurrentItem(1, true)
        }

        applyMineAvatarDisplay()
    }

    private fun setupInsets(root: View) {
        val baseHeaderHeightPx = resources.getDimensionPixelSize(R.dimen.home_header_bar_height)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val statusBarTopPx = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val metrics = MineHeaderLayoutPolicy.resolve(
                baseHeaderHeightPx = baseHeaderHeightPx,
                statusBarTopPx = statusBarTopPx,
            )

            binding.mineHeaderBar.updateLayoutParams<ViewGroup.LayoutParams> {
                height = metrics.overlayHeightPx
            }
            binding.mineHeaderContent.updatePadding(top = metrics.contentPaddingTopPx)
            binding.mineCollapsingHeader.minimumHeight = metrics.collapsingMinimumHeightPx
            insets
        }
        ViewCompat.requestApplyInsets(root)
    }

    private fun applyStatusBarIconStyle(headerAlpha: Float) {
        if ((activity as? MainActivity)?.isMineContentActive() != true) return
        val isDarkMode =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        val controller = WindowInsetsControllerCompat(requireActivity().window, requireView())
        controller.isAppearanceLightStatusBars = !isDarkMode && headerAlpha >= 0.5f
    }

    /** MainActivity 确认「我的」为当前顶层页后，按当前折叠进度恢复状态栏图标颜色。 */
    fun restoreSystemBarStyleForCurrentHeader() {
        if (_binding == null || view == null) return
        applyStatusBarIconStyle(currentHeaderAlpha)
    }

    private fun openAccountEntry() {
        val session = AccountSessionStore.read(requireContext())
        val hostActivity = requireActivity()
        if (session.loggedIn) {
            AccountProfileActivity.start(hostActivity)
        } else {
            LoginActivity.start(hostActivity)
        }
    }

    /** 昵称：侧栏缓存的酷狗；副标题：侧栏缓存的网易。 */
    fun applyMineProfileTexts() {
        val b = _binding ?: return
        val session = AccountSessionStore.read(requireContext())
        if (session.loggedIn) {
            b.nicknameTextView.text = session.user.username.ifBlank { "PisaMusic 用户" }
            b.subtitleTextView.text = session.user.email.ifBlank { "已登录，收藏与歌单会自动同步" }
        } else {
            b.nicknameTextView.text = "登录 / 注册"
            b.subtitleTextView.text = "账号登录后自动同步收藏与歌单"
        }
    }

    /** 按账号登录状态刷新头像。 */
    fun applyMineAvatarDisplay() {
        val b = _binding ?: return
        val session = AccountSessionStore.read(requireContext())
        val avatarUrl = if (session.loggedIn) resolveAccountAvatarUrl(session.user) else null
        if (avatarUrl == null) {
            b.avatarImageView.setImageResource(R.drawable.ic_pm_icon)
        } else {
            b.avatarImageView.load(avatarUrl) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
                transformations(CircleCropTransformation())
            }
        }
    }

    private fun resolveAccountAvatarUrl(user: AccountUser): String? {
        val raw = user.avatarUrl.ifBlank { user.avatar }.trim()
        return configManager.resolveSystemUrl(raw)
    }

    /** 选中：onSurface、加粗。未选：onSurfaceVariant（随浅色/深色主题变化，避免夜间仍用 #333）。 */
    private fun applyMineTabStyle(selectedIndex: Int) {
        val ctx = requireContext()
        val onSurface = MaterialColors.getColor(
            ctx,
            com.google.android.material.R.attr.colorOnSurface,
            android.graphics.Color.BLACK,
        )
        val onSurfaceVariant = MaterialColors.getColor(
            ctx,
            com.google.android.material.R.attr.colorOnSurfaceVariant,
            ContextCompat.getColor(ctx, R.color.text_secondary),
        )
        fun styleTab(tv: android.widget.TextView, selected: Boolean) {
            tv.setTextColor(if (selected) onSurface else onSurfaceVariant)
            tv.alpha = 1f
            tv.setTypeface(null, if (selected) Typeface.BOLD else Typeface.NORMAL)
        }
        styleTab(binding.tabMineText, selectedIndex == 0)
        styleTab(binding.tabPlaylistsText, selectedIndex == 1)
    }

}
