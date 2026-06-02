package cn.partialy.pm.ui.mine

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Typeface
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.widget.ViewPager2
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.activity.AccountProfileActivity
import cn.partialy.pm.activity.LoginActivity
import cn.partialy.pm.activity.MainActivity
import cn.partialy.pm.activity.SearchActivity
import cn.partialy.pm.databinding.FragmentMineBinding
import cn.partialy.pm.model.AccountUser
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.cookie.DrawerImportProfileCacheStore
import cn.partialy.pm.ui.widget.MineViewPagerNestedHost
import coil.load
import coil.transform.CircleCropTransformation
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.color.MaterialColors
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class MineFragment : Fragment() {

    @Inject
    lateinit var mineAvatarSettings: MineAvatarSettings

    @Inject
    lateinit var drawerImportProfileCacheStore: DrawerImportProfileCacheStore

    private var _binding: FragmentMineBinding? = null
    private val binding get() = _binding!!

    private val pickLocalAvatarLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri ->
        if (uri == null) return@registerForActivityResult
        lifecycleScope.launch {
            val ok = withContext(Dispatchers.IO) {
                mineAvatarSettings.saveLocalAvatarFromUri(uri)
            }
            if (_binding == null) return@launch
            if (ok) {
                mineAvatarSettings.setSource(MineAvatarSource.LOCAL)
                applyMineAvatarDisplay()
            } else {
                Toast.makeText(
                    requireContext(),
                    R.string.mine_avatar_local_save_failed,
                    Toast.LENGTH_SHORT,
                ).show()
            }
        }
    }

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
        (activity as? MainActivity)?.refreshMineProfileBackgroundFromDrawerCache()
        applyMineProfileTexts()
        applyMineAvatarDisplay()
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
        super.onDestroyView()
        _binding = null
    }

    @SuppressLint("ResourceAsColor")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val baseHeaderHeightPx = (56f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
        val isDarkMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val insetsController = WindowInsetsControllerCompat(requireActivity().window, view)

        fun applyStatusBarIconStyle(headerAlpha: Float) {
            if (isDarkMode) {
                insetsController.isAppearanceLightStatusBars = false
                return
            }
            insetsController.isAppearanceLightStatusBars = headerAlpha >= 0.5f
        }

        ViewCompat.setOnApplyWindowInsetsListener(binding.mineHeaderBar) { v, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            v.layoutParams = v.layoutParams.apply { height = baseHeaderHeightPx + top }
            binding.mineHeaderContent.updatePadding(top = top)
            insets
        }

        binding.mineMenuButton.setOnClickListener {
            (activity as? MainActivity)?.openMainDrawer()
        }
        binding.mineSearchButton.setOnClickListener {
            SearchActivity.start(requireActivity())
        }

        binding.avatarImageView.setOnClickListener { openAccountEntry() }

        applyMineProfileTexts()

        val triggerPx = (200f * resources.displayMetrics.density).toInt().coerceAtLeast(1)
        binding.mineScrollView.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            val a = (scrollY.toFloat() / triggerPx).coerceIn(0f, 1f)
            binding.mineHeaderBg.alpha = a
            applyStatusBarIconStyle(a)

            val iconTint = if (a < 0.5f) {
                android.R.color.white
            } else {
                R.color.colorOnBgNormal
            }
            if (a < 0.9f) {
                binding.titleText.visibility = View.GONE
            } else {
                binding.titleText.visibility = View.VISIBLE
            }
            val color = requireContext().getColor(iconTint)
            binding.mineMenuButton.setColorFilter(color)
            binding.mineSearchButton.setColorFilter(color)
            binding.titleText.setTextColor(requireContext().getColor(R.color.colorOnBgNormal))
        }

        binding.mineHeaderBg.alpha = 0f
        applyStatusBarIconStyle(0f)
        run {
            val color = requireContext().getColor(android.R.color.white)
            binding.mineMenuButton.setColorFilter(color)
            binding.mineSearchButton.setColorFilter(color)
        }

        binding.mineTabViewPager.adapter = MineTabPagerAdapter(this)
        binding.mineTabViewPager.offscreenPageLimit = 1
        binding.mineTabViewPager.registerOnPageChangeCallback(
            object : ViewPager2.OnPageChangeCallback() {
                override fun onPageSelected(position: Int) {
                    applyMineTabStyle(position)
                    adjustMineViewPagerHeightForCurrentPage()
                }
            },
        )
        applyMineTabStyle(0)
        adjustMineViewPagerHeightForCurrentPage()

        binding.tabMineText.setOnClickListener {
            binding.mineTabViewPager.setCurrentItem(0, true)
        }
        binding.tabPlaylistsText.setOnClickListener {
            binding.mineTabViewPager.setCurrentItem(1, true)
        }

        applyMineAvatarDisplay()
    }

    /** 歌单列表高度更新后回调，用于刷新包裹在 NestedScrollView 内的 ViewPager2 高度。 */
    fun requestMineViewPagerHeightUpdate() {
        if (_binding == null) return
        adjustMineViewPagerHeightForCurrentPage()
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

    private fun showMineAvatarBottomSheet() {
        val ctx = requireContext()
        val dialog = BottomSheetDialog(
            ctx,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val sheet = layoutInflater.inflate(R.layout.bottom_sheet_mine_avatar, null)
        dialog.setContentView(sheet)
        dialog.setOnShowListener {
            dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
                ?.setBackgroundResource(R.drawable.bg_mine_avatar_bottom_sheet)
        }
        sheet.findViewById<View>(R.id.mineAvatarOptionKg).setOnClickListener {
            mineAvatarSettings.setSource(MineAvatarSource.KUGOU)
            applyMineAvatarDisplay()
            dialog.dismiss()
        }
        sheet.findViewById<View>(R.id.mineAvatarOptionWy).setOnClickListener {
            mineAvatarSettings.setSource(MineAvatarSource.WY)
            applyMineAvatarDisplay()
            dialog.dismiss()
        }
        sheet.findViewById<View>(R.id.mineAvatarOptionLocal).setOnClickListener {
            dialog.dismiss()
            pickLocalAvatarLauncher.launch("image/*")
        }
        sheet.findViewById<View>(R.id.mineAvatarSheetCancel).setOnClickListener {
            dialog.dismiss()
        }
        dialog.show()
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

    /** 按持久化的来源与 [DrawerImportProfileCacheStore] / 本地文件刷新头像。 */
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
        if (raw.isBlank()) return null
        if (raw.startsWith("http://") || raw.startsWith("https://")) return raw
        if (!raw.startsWith("/")) return null
        return BuildConfig.SYSTEM_SERVICE_BASE_URL.trimEnd('/') + raw
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

    private fun adjustMineViewPagerHeightForCurrentPage() {
        val pager = binding.mineTabViewPager
        pager.post {
            val recycler = pager.getChildAt(0) as? RecyclerView ?: return@post
            val currentItemView = recycler.findViewHolderForAdapterPosition(pager.currentItem)?.itemView
                ?: return@post

            val widthSpec = View.MeasureSpec.makeMeasureSpec(pager.width, View.MeasureSpec.EXACTLY)
            val heightSpec = View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
            currentItemView.measure(widthSpec, heightSpec)

            val targetHeight = currentItemView.measuredHeight
            if (pager.layoutParams.height != targetHeight) {
                pager.layoutParams = pager.layoutParams.apply { height = targetHeight }
            }

            (pager.parent as? MineViewPagerNestedHost)?.layoutParams =
                (pager.parent as? MineViewPagerNestedHost)?.layoutParams?.apply { height = targetHeight }
        }
    }
}
