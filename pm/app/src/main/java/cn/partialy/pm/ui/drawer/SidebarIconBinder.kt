package cn.partialy.pm.ui.drawer

import android.content.Context
import android.content.res.ColorStateList
import android.widget.ImageView
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.core.widget.ImageViewCompat
import cn.partialy.pm.R
import cn.partialy.pm.model.SidebarMenuItemDto
import coil.ImageLoader
import coil.decode.SvgDecoder
import coil.request.ImageRequest
import java.nio.ByteBuffer
import java.util.Locale

/**
 * 统一绑定侧栏横栏/九宫格图标：支持 none、preset、svg（含 currentColor 主题替换）与远程 image。
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
        bindInternal(imageView, item, hideWhenMissing = true)
    }

    fun bindGridIcon(imageView: ImageView, item: SidebarMenuItemDto) {
        bindInternal(imageView, item, hideWhenMissing = false)
    }

    private fun bindInternal(
        imageView: ImageView,
        item: SidebarMenuItemDto,
        hideWhenMissing: Boolean,
    ) {
        val context = imageView.context
        when (item.iconType) {
            "none" -> {
                if (hideWhenMissing) {
                    imageView.setImageDrawable(null)
                    imageView.isVisible = false
                } else {
                    applyTintedDrawable(imageView, R.drawable.ic_link_24)
                }
            }

            "preset" -> {
                val resId = SidebarPresetIconRegistry.resolve(item.iconValue)
                if (resId != null) {
                    applyTintedDrawable(imageView, resId)
                } else if (hideWhenMissing) {
                    imageView.setImageDrawable(null)
                    imageView.isVisible = false
                } else {
                    applyTintedDrawable(imageView, R.drawable.ic_link_24)
                }
            }

            "svg" -> {
                val rawSvg = item.iconValue.trim()
                if (rawSvg.isEmpty()) {
                    if (hideWhenMissing) {
                        imageView.setImageDrawable(null)
                        imageView.isVisible = false
                    } else {
                        applyTintedDrawable(imageView, R.drawable.ic_link_24)
                    }
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
                        onError = {
                            if (hideWhenMissing) {
                                imageView.setImageDrawable(null)
                                imageView.isVisible = false
                            } else {
                                applyTintedDrawable(imageView, R.drawable.ic_link_24)
                            }
                        },
                    )
                    .build()
                imageLoader(context).enqueue(request)
            }

            "image" -> {
                val url = item.iconValue.trim()
                if (url.isEmpty()) {
                    if (hideWhenMissing) {
                        imageView.setImageDrawable(null)
                        imageView.isVisible = false
                    } else {
                        applyTintedDrawable(imageView, R.drawable.ic_link_24)
                    }
                    return
                }
                imageView.isVisible = true
                ImageViewCompat.setImageTintList(imageView, null)
                val request = ImageRequest.Builder(context)
                    .data(url)
                    .target(
                        onSuccess = { drawable -> imageView.setImageDrawable(drawable) },
                        onError = {
                            if (hideWhenMissing) {
                                imageView.setImageDrawable(null)
                                imageView.isVisible = false
                            } else {
                                applyTintedDrawable(imageView, R.drawable.ic_link_24)
                            }
                        },
                    )
                    .build()
                imageLoader(context).enqueue(request)
            }

            else -> {
                if (hideWhenMissing) {
                    imageView.setImageDrawable(null)
                    imageView.isVisible = false
                } else {
                    applyTintedDrawable(imageView, R.drawable.ic_link_24)
                }
            }
        }
    }

    private fun applyTintedDrawable(imageView: ImageView, resId: Int) {
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
