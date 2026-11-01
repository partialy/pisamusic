package cn.partialy.pm.ui.dialog

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.ActivityNotFoundException
import android.graphics.Bitmap
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.appshare.AppShareConfig
import cn.partialy.pm.appshare.AppShareRepository
import cn.partialy.pm.share.ShareQrBitmapFactory
import coil.load
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

/** App 分发配置独立于歌曲分享，无需账号与分享记录。 */
object AppShareBottomSheet {
    fun show(activity: FragmentActivity) {
        val repository = EntryPointAccessors.fromApplication(
            activity.applicationContext,
            AppShareEntryPoint::class.java,
        ).appShareRepository()
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val root = activity.layoutInflater.inflate(R.layout.bottom_sheet_app_share, null)
        val icon = root.findViewById<ImageView>(R.id.shareInfoCoverView)
        val qr = root.findViewById<ImageView>(R.id.appShareQrImage)
        var snapshot = repository.cachedOrDefault()
        var refreshJob: Job? = null

        fun render(config: AppShareConfig, bitmap: Bitmap) {
            snapshot = config
            root.findViewById<TextView>(R.id.shareInfoTitleView).text = config.appName
            root.findViewById<TextView>(R.id.shareInfoDescriptionView).text = config.version
            root.findViewById<TextView>(R.id.appShareDescription).text = config.description
            icon.load(config.iconUrl.takeIf { it.isNotBlank() }) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
                fallback(R.drawable.ic_pm_icon)
            }
            qr.setImageBitmap(bitmap)
        }

        root.findViewById<View>(R.id.appShareCopyButton).setOnClickListener {
            val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText(snapshot.appName, snapshot.copyText))
            (activity as? BaseActivity)?.showMessage(activity.getString(R.string.share_link_copied))
        }
        root.findViewById<View>(R.id.appShareMoreButton).setOnClickListener {
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, snapshot.copyText)
            }
            try {
                activity.startActivity(Intent.createChooser(send, activity.getString(R.string.app_share_title)))
            } catch (_: ActivityNotFoundException) {
                (activity as? BaseActivity)?.showMessage(activity.getString(R.string.app_share_no_target))
            }
        }
        root.findViewById<View>(R.id.appShareCloseButton).setOnClickListener { dialog.dismiss() }
        dialog.setContentView(root)
        dialog.setOnShowListener {
            val sheet = dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
                ?: return@setOnShowListener
            BottomSheetBehavior.from(sheet).apply {
                skipCollapsed = true
                maxHeight = (activity.resources.displayMetrics.heightPixels * 0.82f).roundToInt()
                state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        val lifecycleObserver = object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) { dialog.dismiss() }
        }
        activity.lifecycle.addObserver(lifecycleObserver)
        dialog.setOnDismissListener {
            refreshJob?.cancel()
            activity.lifecycle.removeObserver(lifecycleObserver)
            icon.load(null)
        }
        render(snapshot, ShareQrBitmapFactory.create(snapshot.qrCodeText, 432))
        dialog.show()
        refreshJob = activity.lifecycleScope.launch {
            try {
                val config = repository.refresh()
                val bitmap = withContext(Dispatchers.Default) {
                    ShareQrBitmapFactory.create(config.qrCodeText, 432)
                }
                render(config, bitmap)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                // 配置刷新失败不打断分享，保留当前完整快照。
            }
        }
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface AppShareEntryPoint {
        fun appShareRepository(): AppShareRepository
    }
}
