package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.widget.TextView
import androidx.core.view.isVisible
import cn.partialy.pm.R
import com.google.android.material.R.style.MaterialAlertDialog_Material3
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.progressindicator.LinearProgressIndicator
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

/**
 * 现代风格对话框工具类
 * 支持中心对话框和底部弹窗两种样式
 * 支持单选功能
 */
class ModernDialog private constructor(
    private val context: Context,
    private val builder: Builder
) {
    private var dialog: Dialog? = null
    private var bottomSheetDialog: BottomSheetDialog? = null
    
    /**
     * 显示对话框
     */
    fun show() {
        when {
            // 如果有选项列表，则显示单选对话框
            builder.isDownloadDialog -> showDownloadDialog()
            builder.items != null -> showSingleChoiceDialog()
            // 否则根据样式显示普通对话框
            else -> when (builder.style) {
                Style.CENTER -> showCenterDialog()
                Style.BOTTOM -> showBottomDialog()
            }
        }
    }
    
    /**
     * 显示中心对话框
     */
    private fun showCenterDialog() {
        dialog = MaterialAlertDialogBuilder(context, MaterialAlertDialog_Material3)
            .setTitle(builder.title)
            .setMessage(builder.message)
            .setPositiveButton(builder.positiveText) { _, _ ->
                builder.onPositiveClick?.invoke()
            }
            .apply {
                builder.negativeText?.let { text ->
                    setNegativeButton(text) { _, _ ->
                        builder.onNegativeClick?.invoke()
                    }
                }
                builder.neutralText?.let { text ->
                    setNeutralButton(text) { _, _ ->
                        builder.onNeutralClick?.invoke()
                    }
                }
                setCancelable(builder.cancelable)
            }
            .show()
    }
    
    /**
     * 显示底部弹窗
     */
    private fun showBottomDialog() {
        bottomSheetDialog = BottomSheetDialog(context, com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog).apply {
            setContentView(createBottomSheetView())
            behavior.apply {
                isDraggable = builder.cancelable
                state = BottomSheetBehavior.STATE_EXPANDED
            }
            setCancelable(builder.cancelable)
            show()
        }
    }
    
    /**
     * 创建底部弹窗视图
     */
    private fun createBottomSheetView(): View {
        return LayoutInflater.from(context).inflate(R.layout.layout_modern_bottom_sheet, null).apply {
            // 设置标题
            findViewById<TextView>(R.id.titleText)?.text = builder.title
            
            // 设置消息
            findViewById<TextView>(R.id.messageText)?.text = builder.message
            
            // 设置按钮
            findViewById<MaterialButton>(R.id.positiveButton)?.apply {
                text = builder.positiveText
                setOnClickListener { 
                    builder.onPositiveClick?.invoke()
                    bottomSheetDialog?.dismiss()
                }
            }
            
            findViewById<MaterialButton>(R.id.negativeButton)?.apply {
                visibility = if (builder.negativeText != null) View.VISIBLE else View.GONE
                text = builder.negativeText
                setOnClickListener {
                    builder.onNegativeClick?.invoke()
                    bottomSheetDialog?.dismiss()
                }
            }
        }
    }
    
    /**
     * 显示单选对话框
     */
    private fun showSingleChoiceDialog() {
        var selectedIndex = builder.selectedIndex
        
        dialog = MaterialAlertDialogBuilder(context, MaterialAlertDialog_Material3)
            .setTitle(builder.title)
            .setSingleChoiceItems(
                builder.items?.toTypedArray(),
                builder.selectedIndex
            ) { _, which ->
                selectedIndex = which
            }
            .setPositiveButton(builder.positiveText) { _, _ ->
                builder.onItemSelected?.invoke(selectedIndex, builder.items?.get(selectedIndex))
            }
            .apply {
                builder.negativeText?.let { text ->
                    setNegativeButton(text) { _, _ ->
                        builder.onNegativeClick?.invoke()
                    }
                }
                setCancelable(builder.cancelable)
            }
            .show()
    }
    
    /**
     * 显示下载对话框
     */
    private fun showDownloadDialog() {
        bottomSheetDialog = BottomSheetDialog(context, com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog).apply {
            setContentView(createDownloadSheetView())
            behavior.apply {
                isDraggable = builder.cancelable
                state = BottomSheetBehavior.STATE_EXPANDED
            }
            setCancelable(builder.cancelable)
            show()
        }
    }
    
    /**
     * 创建下载对话框视图
     */
    private fun createDownloadSheetView(): View {
        return LayoutInflater.from(context).inflate(R.layout.layout_modern_bottom_sheet, null).apply {
            // 设置标题
            findViewById<TextView>(R.id.titleText)?.text = builder.title
            
            // 设置消息
            findViewById<TextView>(R.id.messageText)?.text = builder.message
            
            // 设置进度条
            findViewById<LinearProgressIndicator>(R.id.progressBar)?.apply {
                isVisible = true
                max = 100
                progress = 0
            }
            
            // 设置按钮
            findViewById<MaterialButton>(R.id.positiveButton)?.apply {
                text = builder.positiveText
                setOnClickListener { 
                    builder.onPositiveClick?.invoke()
                    bottomSheetDialog?.dismiss()
                }
            }
            
            findViewById<MaterialButton>(R.id.negativeButton)?.apply {
                visibility = if (builder.negativeText != null) View.VISIBLE else View.GONE
                text = builder.negativeText
                setOnClickListener {
                    builder.onNegativeClick?.invoke()
                    bottomSheetDialog?.dismiss()
                }
            }
        }
    }
    
    /**
     * 关闭对话框
     */
    fun dismiss() {
        dialog?.dismiss()
        bottomSheetDialog?.dismiss()
    }
    
    /**
     * 对话框样式枚举
     */
    enum class Style {
        CENTER,  // 中心对话框
        BOTTOM   // 底部弹窗
    }
    
    /**
     * 对话框构建器
     */
    class Builder(private val context: Context) {
        var style: Style = Style.CENTER              // 对话框样式
        var title: String? = null                    // 标题
        var message: String? = null                  // 消息内容
        var positiveText: String = context.getString(android.R.string.ok)  // 确定按钮文本
        var negativeText: String? = null             // 取消按钮文本
        var neutralText: String? = null              // 中性按钮文本
        var cancelable: Boolean = true               // 是否可取消
        var onPositiveClick: (() -> Unit)? = null    // 确定按钮点击回调
        var onNegativeClick: (() -> Unit)? = null    // 取消按钮点击回调
        var onNeutralClick: (() -> Unit)? = null     // 中性按钮点击回调
        
        // 单选对话框相关属性
        var items: List<String>? = null              // 选项列表
        var selectedIndex: Int = -1                  // 默认选中项
        var onItemSelected: ((index: Int, item: String?) -> Unit)? = null  // 选择回调
        
        var isDownloadDialog: Boolean = false  // 新增：是否为下载对话框
        
        fun build() = ModernDialog(context, this)
    }
    
    companion object {
        /**
         * 创建对话框的便捷方法
         * @param context 上下文
         * @param block 配置代码块
         */
        fun make(context: Context, block: Builder.() -> Unit): ModernDialog {
            return Builder(context).apply(block).build()
        }

        /**
         * 显示单选对话框
         * @param context 上下文
         * @param title 标题
         * @param items 选项列表
         * @param selectedIndex 默认选中项
         * @return 选中的选项
         */
        suspend fun showSingleChoice(
            context: Context,
            title: String,
            items: List<String>,
            selectedIndex: Int = -1
        ): String? = suspendCoroutine { continuation ->
            make(context) {
                this.title = title
                this.items = items
                this.selectedIndex = selectedIndex
                this.positiveText = context.getString(android.R.string.ok)
                this.negativeText = context.getString(android.R.string.cancel)
                onItemSelected = { index, item ->
                    continuation.resume(item)
                }
            }.show()
        }

        /**
         * 创建下载对话框
         */
        fun makeDownloadDialog(context: Context, block: Builder.() -> Unit): ModernDialog {
            return Builder(context).apply { 
                isDownloadDialog = true
                style = Style.BOTTOM
                block()
            }.build()
        }
    }

    /**
     * 更新下载进度
     */
    fun updateProgress(progress: Int) {
        bottomSheetDialog?.findViewById<LinearProgressIndicator>(R.id.progressBar)?.progress = progress
    }

    /**
     * 更新对话框消息
     */
    fun updateMessage(message: String) {
        when {
            dialog != null -> {
                // 更新中心对话框消息
                dialog?.findViewById<TextView>(android.R.id.message)?.text = message
            }
            bottomSheetDialog != null -> {
                // 更新底部对话框消息
                bottomSheetDialog?.findViewById<TextView>(R.id.messageText)?.text = message
            }
        }
    }
} 