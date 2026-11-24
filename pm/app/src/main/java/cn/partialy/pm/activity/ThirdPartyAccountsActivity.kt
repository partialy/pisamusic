package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.drawable.InsetDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityThirdPartyAccountsBinding
import cn.partialy.pm.databinding.ItemThirdPartyAccountBinding
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.cookie.ThirdPartyAccountState
import cn.partialy.pm.network.cookie.ThirdPartyLoginValidity
import cn.partialy.pm.network.cookie.ThirdPartyRefreshState
import cn.partialy.pm.ui.dialog.ActionMenuBottomSheet
import cn.partialy.pm.ui.dialog.ActionMenuItem
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.ui.thirdparty.ThirdPartyAccountsEvent
import cn.partialy.pm.ui.thirdparty.ThirdPartyAccountsViewModel
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import coil.load
import coil.request.Disposable
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.imageview.ShapeableImageView
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@AndroidEntryPoint
class ThirdPartyAccountsActivity : BaseActivity() {
    private val model: ThirdPartyAccountsViewModel by viewModels()
    private lateinit var binding: ActivityThirdPartyAccountsBinding
    private var firstResume = true
    private var recreated = false
    private var menu: PopupWindow? = null
    private var accountMenu: BottomSheetDialog? = null
    private var confirmation: android.app.Dialog? = null
    private var renderingRefreshSettings = false
    private val avatarRequests = mutableMapOf<ImageView, Disposable>()

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityThirdPartyAccountsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)
        recreated = savedInstanceState != null
        val night = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !night, lightNavigationBarIcons = !night)
        binding.root.applySystemBarsInsets(protectIme = true) { bars ->
            binding.statusBarSpacer.updateLayoutParams { height = bars.top }
            binding.bottomActions.updatePadding(bottom = dp(16) + bars.bottom)
        }
        binding.backButton.setOnClickListener { finish() }
        binding.moreButton.setOnClickListener { showMenu() }
        binding.importButton.setOnClickListener { ThirdPartyPlaylistImportActivity.start(this) }
        binding.autoRefreshSwitch.setOnCheckedChangeListener { _, enabled ->
            if (!renderingRefreshSettings) model.setAutoRefresh(enabled)
        }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    combine(model.states, model.clearing, model.refreshState) { accounts, clearing, refresh ->
                        Triple(accounts, clearing, refresh)
                    }.collect { (accounts, clearing, refresh) -> render(accounts, clearing, refresh) }
                }
                launch {
                    model.events.collect { event ->
                        when (event) {
                            ThirdPartyAccountsEvent.NETWORK_ERROR -> PmMessage.error(this@ThirdPartyAccountsActivity, R.string.third_party_accounts_network_error)
                            ThirdPartyAccountsEvent.CLEAR_FAILED -> PmMessage.error(this@ThirdPartyAccountsActivity, R.string.third_party_accounts_clear_failed)
                            ThirdPartyAccountsEvent.CLEARED -> PmMessage.success(this@ThirdPartyAccountsActivity, R.string.drawer_clear_third_party_login_done)
                            is ThirdPartyAccountsEvent.RefreshFailed -> PmMessage.error(this@ThirdPartyAccountsActivity,
                                getString(R.string.third_party_accounts_refresh_failed,
                                    event.sources.map { it.uppercase(Locale.ROOT) }.distinct().joinToString("、")))
                            ThirdPartyAccountsEvent.REFRESHED -> PmMessage.success(this@ThirdPartyAccountsActivity, R.string.third_party_accounts_refreshed)
                            ThirdPartyAccountsEvent.SETTINGS_FAILED -> {
                                render(model.states.value, model.clearing.value, model.refreshState.value)
                                PmMessage.error(this@ThirdPartyAccountsActivity, R.string.third_party_accounts_settings_failed)
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        model.validateOnResume(recreated = firstResume && recreated)
        firstResume = false
    }

    private fun render(accounts: List<ThirdPartyAccountState>, clearing: Boolean, refresh: ThirdPartyRefreshState) {
        val busy = clearing || refresh.refreshing
        bindAccount(binding.kgAccount, accounts.firstOrNull { it.source == MusicCookieManager.SOURCE_KG }, true, busy)
        bindAccount(binding.wyAccount, accounts.firstOrNull { it.source == MusicCookieManager.SOURCE_WY }, false, busy)
        binding.importButton.isEnabled = accounts.any { it.loggedIn } && !busy
        binding.moreButton.isEnabled = !busy
        renderingRefreshSettings = true
        binding.autoRefreshSwitch.isChecked = refresh.autoRefresh
        renderingRefreshSettings = false
        binding.autoRefreshSwitch.isEnabled = !busy
        val lastRefresh = if (refresh.lastAttemptAt > 0) {
            SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(refresh.lastAttemptAt))
        } else getString(R.string.third_party_accounts_refresh_none)
        binding.lastRefreshTextView.text = getString(R.string.third_party_accounts_last_refresh, lastRefresh)
        val result = when {
            refresh.refreshing -> R.string.third_party_accounts_refreshing
            refresh.lastSucceeded == true -> R.string.third_party_accounts_refresh_success
            refresh.lastSucceeded == false -> R.string.third_party_accounts_refresh_failure
            else -> R.string.third_party_accounts_refresh_none
        }
        binding.lastRefreshResultTextView.text = getString(R.string.third_party_accounts_last_refresh_result, getString(result))
        if (busy) {
            menu?.dismiss()
            accountMenu?.dismiss()
        }
    }

    private fun bindAccount(row: ItemThirdPartyAccountBinding, account: ThirdPartyAccountState?, kg: Boolean, clearing: Boolean) {
        val loggedIn = account?.loggedIn == true
        val platform = getString(if (kg) R.string.third_party_accounts_kg else R.string.third_party_accounts_wy)
        val brand = if (kg) R.drawable.third_party_kg else R.drawable.third_party_wy
        val profile = account?.profile
        row.nameTextView.text = if (loggedIn) {
            profile?.nickname?.takeIf { it.isNotBlank() } ?: profile?.username?.takeIf { it.isNotBlank() } ?: platform
        } else platform
        if (loggedIn) SongSourceTagBinder.bind(row.sourceTag, if (kg) SongType.KG else SongType.WY)
        else SongSourceTagBinder.hide(row.sourceTag)
        row.statusTextView.isVisible = loggedIn
        row.notLoggedInTextView.isVisible = !loggedIn
        row.statusTextView.setText(when (account?.validity) {
            ThirdPartyLoginValidity.VALID -> R.string.third_party_accounts_valid
            ThirdPartyLoginValidity.EXPIRED -> R.string.third_party_accounts_expired
            else -> R.string.third_party_accounts_unchecked
        })
        row.statusTextView.setTextColor(ContextCompat.getColor(this,
            if (loggedIn && account?.validity == ThirdPartyLoginValidity.EXPIRED) R.color.pm_dialog_danger else R.color.text_secondary))
        row.checkingProgress.isVisible = account?.checking == true
        row.moreButton.isVisible = loggedIn
        row.root.isEnabled = !clearing
        row.moreButton.isEnabled = !clearing
        loadAvatar(row.avatarView, if (loggedIn) profile?.avatarUrl else null, brand)
        row.root.setOnClickListener {
            if (clearing) return@setOnClickListener
            if (!loggedIn || account?.validity == ThirdPartyLoginValidity.EXPIRED) openLogin(kg)
            else account?.let(::showAccountMenu)
        }
        row.moreButton.setOnClickListener { if (!clearing) account?.let(::showAccountMenu) }
    }

    private fun openLogin(kg: Boolean) {
        if (kg) PlaylistImportActivity.start(this, SongType.KG) else WyWebPlaylistLoginActivity.start(this)
    }

    private fun showMenu() {
        menu?.dismiss()
        val content = layoutInflater.inflate(R.layout.layout_search_source_dropdown, null, false)
        val container = content.findViewById<LinearLayout>(R.id.searchSourceOptionsContainer)
        val window = PopupWindow(content, dp(180), ViewGroup.LayoutParams.WRAP_CONTENT, true).apply {
            isOutsideTouchable = true
            elevation = dp(8).toFloat()
        }
        val actions = listOf(
            Triple(R.drawable.ic_refresh_24, R.string.third_party_accounts_batch_refresh, { model.refreshAll() }),
            Triple(R.drawable.ic_delete_24, R.string.third_party_accounts_clear_all, { confirmClearAll() }),
        )
        actions.forEachIndexed { index, (icon, title, action) ->
            val row = layoutInflater.inflate(R.layout.item_compact_action_menu_row, container, false)
            val image = row.findViewById<ImageView>(R.id.actionMenuItemIcon)
            val text = row.findViewById<TextView>(R.id.actionMenuItemText)
            image.setImageResource(icon)
            text.setText(title)
            if (index == 1) {
                val danger = ContextCompat.getColor(this, R.color.pm_dialog_danger)
                image.setColorFilter(danger)
                text.setTextColor(danger)
            }
            row.isEnabled = model.states.value.any { it.loggedIn }
            row.alpha = if (row.isEnabled) 1f else 0.45f
            row.setOnClickListener { window.dismiss(); action() }
            container.addView(row)
        }
        menu = window
        window.setOnDismissListener { if (menu === window) menu = null }
        window.showAsDropDown(binding.moreButton, 0, dp(6), Gravity.END)
    }

    private fun showAccountMenu(account: ThirdPartyAccountState) {
        accountMenu?.dismiss()
        var headerAvatar: ImageView? = null
        val kg = account.source == MusicCookieManager.SOURCE_KG
        val name = account.profile?.nickname?.takeIf { it.isNotBlank() }
            ?: account.profile?.username?.takeIf { it.isNotBlank() }
            ?: getString(if (kg) R.string.third_party_accounts_kg else R.string.third_party_accounts_wy)
        accountMenu = ActionMenuBottomSheet.show(this, listOf(
            ActionMenuItem(R.drawable.ic_refresh_24, getString(R.string.third_party_accounts_refresh)) { model.refresh(account) },
            ActionMenuItem(R.drawable.ic_delete_24, getString(R.string.third_party_accounts_clear), R.color.pm_dialog_danger) { confirmClear(account) },
        ), bindHeader = { root ->
            root.findViewById<TextView>(R.id.songInfoTitleView).text = name
            root.findViewById<TextView>(R.id.songInfoArtistView).text = getString(if (kg) R.string.third_party_accounts_kg else R.string.third_party_accounts_wy)
            val avatar = root.findViewById<ShapeableImageView>(R.id.songInfoCoverView)
            headerAvatar = avatar
            avatar.shapeAppearanceModel = avatar.shapeAppearanceModel.toBuilder().setAllCornerSizes(dp(28).toFloat()).build()
            loadAvatar(avatar, account.profile?.avatarUrl, if (kg) R.drawable.third_party_kg else R.drawable.third_party_wy)
        }, onDismiss = {
            headerAvatar?.let { avatarRequests.remove(it)?.dispose() }
            accountMenu = null
        })
    }

    private fun confirmClear(account: ThirdPartyAccountState) {
        if (confirmation?.isShowing == true || model.clearing.value || model.refreshState.value.refreshing) return
        val platform = getString(if (account.source == MusicCookieManager.SOURCE_KG) R.string.third_party_accounts_kg else R.string.third_party_accounts_wy)
        confirmation = PmMinimalDialog.show(this,
            title = getString(R.string.drawer_clear_third_party_login_confirm_title),
            message = getString(R.string.third_party_accounts_clear_confirm, platform),
            cancelText = getString(R.string.cancel), confirmText = getString(R.string.dialog_ok),
            confirmColor = ContextCompat.getColor(this, R.color.pm_dialog_danger),
            onConfirm = { model.clear(account) },
        )
    }

    private fun confirmClearAll() {
        if (confirmation?.isShowing == true || model.clearing.value || model.refreshState.value.refreshing) return
        val expected = model.states.value.toList()
        if (expected.none { it.loggedIn }) return
        confirmation = PmMinimalDialog.show(this,
            title = getString(R.string.drawer_clear_third_party_login_confirm_title),
            message = getString(R.string.drawer_clear_third_party_login_confirm_message),
            cancelText = getString(R.string.cancel), confirmText = getString(R.string.dialog_ok),
            confirmColor = ContextCompat.getColor(this, R.color.pm_dialog_danger),
            onConfirm = { model.clearAll(expected) },
        )
    }

    private fun loadAvatar(view: ImageView, url: String?, brand: Int) {
        avatarRequests.remove(view)?.dispose()
        // 两张 nodpi 品牌 PNG 均有 6px 透明边，先移出显示边界再由头像控件裁成圆形。
        val brandAvatar = InsetDrawable(requireNotNull(ContextCompat.getDrawable(this, brand)), -6)
        avatarRequests[view] = view.load(url?.takeIf { it.startsWith("https://") || it.startsWith("http://") } ?: brandAvatar) {
            placeholder(brandAvatar)
            error(brandAvatar)
            fallback(brandAvatar)
        }
    }

    override fun onDestroy() {
        menu?.dismiss()
        accountMenu?.dismiss()
        confirmation?.dismiss()
        avatarRequests.values.forEach { it.dispose() }
        avatarRequests.clear()
        super.onDestroy()
    }

    private fun dp(value: Int): Int = (resources.displayMetrics.density * value).toInt()

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, ThirdPartyAccountsActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
