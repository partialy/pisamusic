package cn.partialy.pm.announcement

import android.animation.ObjectAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.text.Spannable
import android.text.SpannableStringBuilder
import android.text.TextPaint
import android.text.method.LinkMovementMethod
import android.text.style.ClickableSpan
import android.text.style.ForegroundColorSpan
import android.text.style.ImageSpan
import android.text.style.StyleSpan
import android.text.style.UnderlineSpan
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.DrawableCompat
import cn.partialy.pm.R
import coil.load
import coil.transform.RoundedCornersTransformation
import com.google.android.material.color.MaterialColors

object AnnouncementContentRenderer {

    fun render(
        container: ViewGroup,
        content: AnnouncementContent,
        onAction: (AnnouncementAction) -> Unit,
    ) {
        container.removeAllViews()
        val context = container.context
        val normalized = parseAnnouncementContent(content)

        val defaultTextColor = MaterialColors.getColor(
            context,
            com.google.android.material.R.attr.colorOnSurface,
            ContextCompat.getColor(context, R.color.pm_dialog_message),
        )
        val defaultPrimaryColor = MaterialColors.getColor(
            context,
            com.google.android.material.R.attr.colorPrimary,
            ContextCompat.getColor(context, R.color.home_tab_selected),
        )

        val inlineBlocks = mutableListOf<AnnouncementBlock>()

        fun flushInlineBlocks() {
            if (inlineBlocks.isEmpty()) return
            val textView = createParagraphTextView(context, defaultTextColor)
            val builder = SpannableStringBuilder()

            for (block in inlineBlocks) {
                when (block) {
                    is AnnouncementBlock.Text -> {
                        val start = builder.length
                        builder.append(block.text)
                        if (block.bold) {
                            builder.setSpan(
                                StyleSpan(Typeface.BOLD),
                                start,
                                builder.length,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
                            )
                        }
                    }
                    is AnnouncementBlock.Highlight -> {
                        val start = builder.length
                        builder.append(block.text)
                        val endText = builder.length
                        val color = resolveAnnouncementColor(block.color, defaultPrimaryColor)

                        builder.setSpan(
                            ForegroundColorSpan(color),
                            start,
                            endText,
                            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
                        )
                        builder.setSpan(
                            StyleSpan(Typeface.BOLD),
                            start,
                            endText,
                            Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
                        )

                        // 规则 2：只有 URL 和协议才显示下划线
                        if (shouldUnderlineAnnouncementAction(block.action)) {
                            builder.setSpan(
                                UnderlineSpan(),
                                start,
                                endText,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
                            )
                        }

                        // 规则 3：复制操作复用已有的 ic_copy_24 图标
                        if (block.action is AnnouncementAction.Copy) {
                            val copyIcon = createCopyIconDrawable(context, color)
                            if (copyIcon != null) {
                                builder.append("  ")
                                val iconStart = builder.length - 1
                                val iconEnd = builder.length
                                builder.setSpan(
                                    ImageSpan(copyIcon, ImageSpan.ALIGN_BASELINE),
                                    iconStart,
                                    iconEnd,
                                    Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
                                )
                            }
                        }

                        if (block.action !is AnnouncementAction.None) {
                            val isUnderline = shouldUnderlineAnnouncementAction(block.action)
                            val clickableSpan = object : ClickableSpan() {
                                override fun onClick(widget: View) {
                                    onAction(block.action)
                                }

                                override fun updateDrawState(ds: TextPaint) {
                                    super.updateDrawState(ds)
                                    ds.color = color
                                    ds.isUnderlineText = isUnderline
                                }
                            }
                            builder.setSpan(
                                clickableSpan,
                                start,
                                builder.length,
                                Spannable.SPAN_EXCLUSIVE_EXCLUSIVE,
                            )
                        }
                    }
                    is AnnouncementBlock.Image -> Unit
                }
            }

            textView.text = builder
            container.addView(textView)
            inlineBlocks.clear()
        }

        for (block in normalized.blocks) {
            when (block) {
                is AnnouncementBlock.Text, is AnnouncementBlock.Highlight -> {
                    inlineBlocks.add(block)
                }
                is AnnouncementBlock.Image -> {
                    flushInlineBlocks()
                    val imageView = createBlockImageView(context, block)
                    container.addView(imageView)
                }
            }
        }
        flushInlineBlocks()
    }

    private fun createParagraphTextView(context: Context, textColor: Int): TextView {
        return TextView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = dpToPx(context, 4)
                bottomMargin = dpToPx(context, 4)
            }
            setTextColor(textColor)
            textSize = 14f
            setLineSpacing(dpToPx(context, 4).toFloat(), 1.15f)
            movementMethod = LinkMovementMethod.getInstance()
            highlightColor = Color.TRANSPARENT
        }
    }

    private fun createBlockImageView(context: Context, block: AnnouncementBlock.Image): View {
        val cornerPx = dpToPx(context, 8).toFloat()
        val maxHeightPx = dpToPx(context, 260)

        if (block.url.isNullOrBlank()) {
            return ImageView(context).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply {
                    topMargin = dpToPx(context, 8)
                    bottomMargin = dpToPx(context, 8)
                }
                adjustViewBounds = true
                maxHeight = maxHeightPx
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = block.alt.ifEmpty { "公告图片加载失败" }
                setImageResource(R.drawable.announcement_image_load_failed)
            }
        }

        return ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
                topMargin = dpToPx(context, 8)
                bottomMargin = dpToPx(context, 8)
            }
            adjustViewBounds = true
            maxHeight = maxHeightPx
            scaleType = ImageView.ScaleType.FIT_CENTER
            contentDescription = block.alt.ifEmpty { "公告图片" }
            val loadingAnimator = ObjectAnimator.ofFloat(this, View.ROTATION, 0f, 360f).apply {
                duration = 1_500L
                repeatCount = ObjectAnimator.INFINITE
                interpolator = LinearInterpolator()
            }

            fun stopLoadingAnimation() {
                loadingAnimator.cancel()
                rotation = 0f
            }

            load(block.url) {
                crossfade(true)
                transformations(RoundedCornersTransformation(cornerPx))
                error(R.drawable.announcement_image_load_failed)
                placeholder(R.drawable.ic_loading_loop_24)
                listener(
                    onStart = {
                        if (!loadingAnimator.isStarted) loadingAnimator.start()
                    },
                    onCancel = { stopLoadingAnimation() },
                    onError = { _, _ -> stopLoadingAnimation() },
                    onSuccess = { _, _ -> stopLoadingAnimation() },
                )
            }
        }
    }

    private fun createCopyIconDrawable(context: Context, tintColor: Int): Drawable? {
        val base = ContextCompat.getDrawable(context, R.drawable.ic_copy_24)?.mutate() ?: return null
        val wrapped = DrawableCompat.wrap(base)
        DrawableCompat.setTint(wrapped, tintColor)
        val size = dpToPx(context, 14)
        wrapped.setBounds(0, 0, size, size)
        return wrapped
    }

    private fun dpToPx(context: Context, dp: Int): Int {
        val density = context.resources.displayMetrics.density
        return (dp * density + 0.5f).toInt()
    }
}
