package cn.partialy.pm.ui.drawer

import android.content.Context
import android.content.res.ColorStateList
import android.widget.ImageView
import androidx.annotation.DrawableRes
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.core.widget.ImageViewCompat
import cn.partialy.pm.R
import cn.partialy.pm.model.SidebarBuiltinItemDto
import cn.partialy.pm.model.SidebarMenuItemDto
import coil.ImageLoader
import coil.decode.SvgDecoder
import coil.request.ImageRequest
import java.nio.ByteBuffer
import java.util.Locale

/**
 * 统一绑定侧栏内置项、横栏及四宫格图标：支持 default、none、preset、svg（含 currentColor 主题替换）与远程 image。
 */
object SidebarIconBinder {

    @Volatile
    private var svgImageLoader: ImageLoader? = null

    private fun imageLoader(context: Context): ImageLoader {
        return svgImageLoader ?: synchronized(this) {
            svgImageLoader ?: ImageLoader.Builder(context.applicationContext)
                .components {
                    add(SvgDecoder.Factory())
                }
                .build()
                .also { svgImageLoader = it }
        }
    }

    fun bindListIcon(imageView: ImageView, item: SidebarMenuItemDto) {
        bindIconSpec(
            imageView = imageView,
            iconType = item.iconType,
            iconValue = item.iconValue,
            fallbackResId = R.drawable.ic_link_24,
            hideWhenMissing = true,
        )
    }

    fun bindGridIcon(imageView: ImageView, item: SidebarMenuItemDto) {
        bindIconSpec(
            imageView = imageView,
            iconType = item.iconType,
            iconValue = item.iconValue,
            fallbackResId = R.drawable.ic_link_24,
            hideWhenMissing = false,
        )
    }

    fun bindBuiltinIcon(
        imageView: ImageView,
        item: SidebarBuiltinItemDto,
        @DrawableRes defaultResId: Int,
    ) {
        if (item.iconType.isBlank() || item.iconType == "default") {
            applyTintedDrawable(imageView, defaultResId)
            return
        }
        bindIconSpec(
            imageView = imageView,
            iconType = item.iconType,
            iconValue = item.iconValue,
            fallbackResId = defaultResId,
            hideWhenMissing = item.iconType == "none",
        )
    }

    private fun bindIconSpec(
        imageView: ImageView,
        iconType: String,
        iconValue: String,
        @DrawableRes fallbackResId: Int,
        hideWhenMissing: Boolean,
    ) {
        val context = imageView.context
        val applyMissing = {
            if (hideWhenMissing) {
                imageView.setImageDrawable(null)
                imageView.isVisible = false
            } else {
                applyTintedDrawable(imageView, fallbackResId)
            }
        }

        when (iconType) {
            "none" -> applyMissing()

            "preset" -> {
                val resId = SidebarPresetIconRegistry.resolve(iconValue)
                if (resId != null) {
                    applyTintedDrawable(imageView, resId)
                } else {
                    applyMissing()
                }
            }

            "svg" -> {
                val rawSvg = iconValue.trim()
                if (rawSvg.isEmpty()) {
                    applyMissing()
                    return
                }
                imageView.isVisible = true
                ImageViewCompat.setImageTintList(imageView, null)
                val themeHex = resolveThemeIconHex(context)
                val themedSvg = rawSvg.replace(CURRENT_COLOR_REGEX, themeHex)
                val buffer = ByteBuffer.wrap(themedSvg.toByteArray(Charsets.UTF_8))
                val request = ImageRequest.Builder(context)
                    .data(buffer)
                    .target(
                        onSuccess = { drawable -> imageView.setImageDrawable(drawable) },
                        onError = { applyMissing() },
                    )
                    .build()
                imageLoader(context).enqueue(request)
            }

            "image" -> {
                val url = iconValue.trim()
                if (url.isEmpty()) {
                    applyMissing()
                    return
                }
                imageView.isVisible = true
                ImageViewCompat.setImageTintList(imageView, null)
                val request = ImageRequest.Builder(context)
                    .data(url)
                    .target(
                        onSuccess = { drawable -> imageView.setImageDrawable(drawable) },
                        onError = { applyMissing() },
                    )
                    .build()
                imageLoader(context).enqueue(request)
            }

            else -> applyMissing()
        }
    }

    private fun applyTintedDrawable(imageView: ImageView, @DrawableRes resId: Int) {
        imageView.isVisible = true
        val tint = ContextCompat.getColor(imageView.context, R.color.colorOnBgNormal)
        ImageViewCompat.setImageTintList(imageView, ColorStateList.valueOf(tint))
        imageView.setImageResource(resId)
    }

    private fun resolveThemeIconHex(context: Context): String {
        val color = ContextCompat.getColor(context, R.color.colorOnBgNormal)
        return String.format(Locale.US, "#%06X", 0xFFFFFF and color)
    }

    private val CURRENT_COLOR_REGEX = Regex("currentColor", RegexOption.IGNORE_CASE)
}
