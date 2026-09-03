package cn.partialy.pm.ui.dialog

import android.app.Activity
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.Space
import android.widget.TextView
import androidx.annotation.AttrRes
import androidx.annotation.ColorInt
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import cn.partialy.pm.R
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import kotlin.math.roundToInt

/**
 * 启动页多操作底部面板（方案3）：
 * 用于承载断网、版本更新等具备多操作按钮的复杂场景。
 *
 * 按钮布局规则：
 * - 按钮数 == 2 时：左右水平排列（1:1 等宽均分）；
 * - 按钮数 >= 3 时：垂直全宽堆叠排列；
 * - 按钮数 == 1 时：单按钮全宽排列；
 * - 支持按钮背景与文字样式定制（强调色、普通浅灰/深灰底色、弱化底色），更新场景支持动态更新下载进度文本并防重禁用。
 */
object SplashActionBottomSheet {

    enum class ActionStyle {
        PRIMARY,
        SECONDARY,
        WEAK,
    }

    data class Action(
        val id: String,
        val text: String,
        val style: ActionStyle = ActionStyle.SECONDARY,
        val isEnabled: Boolean = true,
        val onClick: (handle: Handle) -> Unit,
    )

    class Handle internal constructor(
        val dialog: BottomSheetDialog,
        private val primaryButton: MaterialButton?,
        private val allButtons: List<MaterialButton>,
    ) {
        fun updateDownloadProgress(downloading: Boolean, progress: Int, customText: String = "") {
            primaryButton?.let { btn ->
                if (downloading) {
                    val label = if (progress >= 0) {
                        btn.context.getString(R.string.startup_downloading_progress, progress)
                    } else {
                        customText.ifBlank { btn.context.getString(R.string.startup_downloading_default) }
                    }
                    btn.text = label
                    btn.isEnabled = false
                    btn.alpha = 0.65f
                    allButtons.forEach { other ->
                        if (other != btn) {
                            other.isEnabled = false
                            other.alpha = 0.65f
                        }
                    }
                } else {
                    btn.text = btn.context.getString(R.string.startup_update_now)
                    btn.isEnabled = true
                    btn.alpha = 1.0f
                    allButtons.forEach { other ->
                        other.isEnabled = true
                        other.alpha = 1.0f
                    }
                }
            }
        }

        fun dismiss() {
            if (dialog.isShowing) {
                dialog.dismiss()
            }
        }
    }

    fun show(
        activity: Activity,
        title: String,
        meta: String? = null,
        contentLines: List<String> = emptyList(),
        actions: List<Action>,
        cancelable: Boolean = true,
        onDismiss: () -> Unit = {},
    ): Handle {
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        dialog.setContentView(R.layout.layout_splash_action_bottom_sheet)
        dialog.behavior.isHideable = cancelable
        dialog.behavior.state = BottomSheetBehavior.STATE_EXPANDED
        dialog.setCancelable(cancelable)
        dialog.setCanceledOnTouchOutside(cancelable)

        // 标题与时间
        val titleView = dialog.findViewById<TextView>(R.id.splashActionSheetTitle)
        titleView?.text = title

        val metaView = dialog.findViewById<TextView>(R.id.splashActionSheetMeta)
        val hasMeta = !meta.isNullOrBlank()
        metaView?.isVisible = hasMeta
        if (hasMeta) {
            metaView?.text = meta
        }

        // 内容卡片列表
        val contentContainer = dialog.findViewById<ViewGroup>(R.id.splashActionSheetContentContainer)
        contentContainer?.removeAllViews()
        if (contentLines.isNotEmpty()) {
            contentLines.forEachIndexed { index, line ->
                val rowTextView = TextView(activity).apply {
                    text = line
                    textSize = 14f
                    setTextColor(resolveTextColor(activity))
                    setLineSpacing(4.dp(activity).toFloat(), 1f)
                    if (index > 0) {
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT,
                        ).apply {
                            topMargin = 6.dp(activity)
                        }
                    } else {
                        layoutParams = LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT,
                        )
                    }
                }
                contentContainer?.addView(rowTextView)
            }
        }

        // 底部按钮排布
        val buttonContainer = dialog.findViewById<LinearLayout>(R.id.splashActionSheetButtonContainer)
        buttonContainer?.removeAllViews()

        val buttonViews = mutableListOf<MaterialButton>()
        var primaryBtn: MaterialButton? = null
        var handleRef: Handle? = null

        val isHorizontal = actions.size == 2

        if (isHorizontal) {
            buttonContainer?.orientation = LinearLayout.HORIZONTAL
            buttonContainer?.gravity = Gravity.CENTER_VERTICAL
            actions.forEachIndexed { index, action ->
                if (index > 0) {
                    val spacer = Space(activity).apply {
                        layoutParams = LinearLayout.LayoutParams(12.dp(activity), 1)
                    }
                    buttonContainer?.addView(spacer)
                }
                val btn = createButton(activity, action) {
                    handleRef?.let { h -> action.onClick(h) }
                }
                btn.layoutParams = LinearLayout.LayoutParams(
                    0,
                    48.dp(activity),
                    1f,
                )
                buttonViews.add(btn)
                if (action.style == ActionStyle.PRIMARY && primaryBtn == null) {
                    primaryBtn = btn
                }
                buttonContainer?.addView(btn)
            }
        } else {
            buttonContainer?.orientation = LinearLayout.VERTICAL
            actions.forEachIndexed { index, action ->
                val btn = createButton(activity, action) {
                    handleRef?.let { h -> action.onClick(h) }
                }
                btn.layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    48.dp(activity),
                ).apply {
                    if (index > 0) {
                        topMargin = 10.dp(activity)
                    }
                }
                buttonViews.add(btn)
                if (action.style == ActionStyle.PRIMARY && primaryBtn == null) {
                    primaryBtn = btn
                }
                buttonContainer?.addView(btn)
            }
        }

        val handle = Handle(
            dialog = dialog,
            primaryButton = primaryBtn,
            allButtons = buttonViews,
        )
        handleRef = handle

        dialog.setOnDismissListener { onDismiss() }
        dialog.show()
        return handle
    }

    /**
     * 快捷方法：展示版本更新面板
     */
    fun showUpdate(
        activity: Activity,
        latestVersion: String,
        updateTime: String?,
        updateContent: String?,
        forceUpdate: Boolean,
        onUpdateClick: (handle: Handle) -> Unit,
        onOfficialClick: (handle: Handle) -> Unit,
        onSkipClick: (handle: Handle) -> Unit,
    ): Handle {
        val title = activity.getString(R.string.startup_update_found_title, latestVersion)
        val rawLines = updateContent.orEmpty()
            .split(";")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        val lines = if (rawLines.isEmpty()) {
            listOf(activity.getString(R.string.startup_update_no_notes))
        } else {
            rawLines
        }

        val actions = mutableListOf<Action>()
        actions.add(
            Action(
                id = "update",
                text = activity.getString(R.string.startup_update_now),
                style = ActionStyle.PRIMARY,
                onClick = onUpdateClick,
            ),
        )
        actions.add(
            Action(
                id = "official",
                text = activity.getString(R.string.startup_update_official),
                style = ActionStyle.SECONDARY,
                onClick = onOfficialClick,
            ),
        )
        if (!forceUpdate) {
            actions.add(
                Action(
                    id = "skip",
                    text = activity.getString(R.string.startup_update_skip),
                    style = ActionStyle.WEAK,
                    onClick = onSkipClick,
                ),
            )
        }

        return show(
            activity = activity,
            title = title,
            meta = updateTime,
            contentLines = lines,
            actions = actions,
            cancelable = !forceUpdate,
            onDismiss = {},
        )
    }

    /**
     * 快捷方法：展示网络异常面板
     */
    fun showNetwork(
        activity: Activity,
        message: String?,
        onRetryClick: (handle: Handle) -> Unit,
        onOfficialClick: (handle: Handle) -> Unit,
        onSettingsClick: (handle: Handle) -> Unit,
    ): Handle {
        val title = activity.getString(R.string.startup_network_title)
        val desc = message?.ifBlank { null }
            ?: activity.getString(R.string.startup_network_message)

        val actions = listOf(
            Action(
                id = "retry",
                text = activity.getString(R.string.startup_retry),
                style = ActionStyle.PRIMARY,
                onClick = onRetryClick,
            ),
            Action(
                id = "official",
                text = activity.getString(R.string.startup_official_home),
                style = ActionStyle.SECONDARY,
                onClick = onOfficialClick,
            ),
            Action(
                id = "settings",
                text = activity.getString(R.string.startup_check_settings),
                style = ActionStyle.SECONDARY,
                onClick = onSettingsClick,
            ),
        )

        return show(
            activity = activity,
            title = title,
            meta = null,
            contentLines = listOf(desc),
            actions = actions,
            cancelable = true,
            onDismiss = {},
        )
    }

    private fun createButton(
        context: Context,
        action: Action,
        onClick: () -> Unit,
    ): MaterialButton {
        val btn = MaterialButton(context, null, com.google.android.material.R.attr.materialButtonStyle)
        btn.text = action.text
        btn.isEnabled = action.isEnabled
        btn.cornerRadius = 24.dp(context)
        btn.insetTop = 0
        btn.insetBottom = 0
        btn.minHeight = 48.dp(context)
        btn.setTypeface(btn.typeface, Typeface.BOLD)

        when (action.style) {
            ActionStyle.PRIMARY -> {
                val primaryColor = resolveColorAttr(context, androidx.appcompat.R.attr.colorPrimary)
                btn.backgroundTintList = ColorStateList.valueOf(primaryColor)
                btn.setTextColor(ContextCompat.getColor(context, R.color.action_primary_text))
            }
            ActionStyle.SECONDARY -> {
                btn.backgroundTintList = ContextCompat.getColorStateList(context, R.color.action_secondary_background)
                btn.setTextColor(ContextCompat.getColor(context, R.color.action_secondary_text))
            }
            ActionStyle.WEAK -> {
                btn.backgroundTintList = ContextCompat.getColorStateList(context, R.color.action_secondary_background)
                btn.setTextColor(ContextCompat.getColor(context, R.color.home_mini_player_subtitle))
            }
        }

        btn.setOnClickListener { onClick() }
        return btn
    }

    private fun resolveColorAttr(context: Context, @AttrRes attr: Int): Int {
        val typedValue = TypedValue()
        context.theme.resolveAttribute(attr, typedValue, true)
        return typedValue.data
    }

    @ColorInt
    private fun resolveTextColor(context: Context): Int {
        val typedValue = TypedValue()
        val resolved = context.theme.resolveAttribute(android.R.attr.textColorSecondary, typedValue, true)
        return if (resolved) {
            if (typedValue.resourceId != 0) {
                ContextCompat.getColor(context, typedValue.resourceId)
            } else {
                typedValue.data
            }
        } else {
            ContextCompat.getColor(context, R.color.action_secondary_text)
        }
    }

    private fun Int.dp(context: Context): Int =
        (this * context.resources.displayMetrics.density).roundToInt()
}
