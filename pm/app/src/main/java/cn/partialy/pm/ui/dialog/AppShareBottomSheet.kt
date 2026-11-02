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
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.R
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
import java.net.ConnectException
import java.net.NoRouteToHostException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import kotlin.math.roundToInt

/** App 推广链接按设备与当前账号隔离，歌曲分享仍使用独立链路。 */
object AppShareBottomSheet {
    fun show(activity: FragmentActivity) {
        val repository = EntryPointAccessors.fromApplication(
            activity.applicationContext, AppShareEntryPoint::class.java,
        ).appShareRepository()
        val dialog = BottomSheetDialog(activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog)
        val root = activity.layoutInflater.inflate(R.layout.bottom_sheet_app_share, null)
        val icon = root.findViewById<ImageView>(R.id.shareInfoCoverView)
        val qr = root.findViewById<ImageView>(R.id.appShareQrImage)
        val progress = root.findViewById<View>(R.id.appShareProgress)
        val status = root.findViewById<TextView>(R.id.appShareStatus)
        val retry = root.findViewById<View>(R.id.appShareRetry)
        val copy = root.findViewById<View>(R.id.appShareCopyButton)
        val more = root.findViewById<View>(R.id.appShareMoreButton)
        var snapshot: AppShareConfig? = null
        var snapshotIdentity = repository.identity()
        var refreshJob: Job? = null
        var requestSequence = 0L
        var dismissed = false

        fun actionsEnabled(enabled: Boolean) {
            listOf(copy, more).forEach { it.isEnabled = enabled; it.alpha = if (enabled) 1f else 0.4f }
        }
        fun renderInfo(config: AppShareConfig) {
            root.findViewById<TextView>(R.id.shareInfoTitleView).text = config.appName
            root.findViewById<TextView>(R.id.shareInfoDescriptionView).text = config.version
            root.findViewById<TextView>(R.id.appShareDescription).text = config.description
            icon.load(config.iconUrl.takeIf { it.isNotBlank() }) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
                fallback(R.drawable.ic_pm_icon)
            }
        }
        fun clearLink() {
            snapshot = null
            qr.setImageDrawable(null)
            actionsEnabled(false)
        }
        fun render(config: AppShareConfig, identity: AppShareRepository.Identity, bitmap: Bitmap) {
            snapshot = config
            snapshotIdentity = identity
            renderInfo(config)
            qr.setImageBitmap(bitmap)
            actionsEnabled(true)
        }
        fun currentSnapshot(): AppShareConfig? {
            if (repository.identity() != snapshotIdentity) {
                clearLink()
                return null
            }
            return snapshot
        }

        fun load() {
            refreshJob?.cancel()
            val sequence = ++requestSequence
            val identity = repository.identity()
            clearLink()
            snapshotIdentity = identity
            renderInfo(repository.displayConfig())
            status.setText(R.string.app_share_loading)
            status.visibility = View.VISIBLE
            progress.visibility = View.VISIBLE
            retry.visibility = View.GONE
            refreshJob = activity.lifecycleScope.launch {
                try {
                    repository.cached(identity)?.let { cached ->
                        val bitmap = withContext(Dispatchers.Default) {
                            ShareQrBitmapFactory.create(cached.qrCodeText, 432)
                        }
                        if (sequence == requestSequence && repository.identity() == identity && !dismissed) {
                            render(cached, identity, bitmap)
                            progress.visibility = View.GONE
                        }
                    }
                    val (receivedIdentity, config) = repository.refresh(identity)
                    val bitmap = withContext(Dispatchers.Default) {
                        ShareQrBitmapFactory.create(config.qrCodeText, 432)
                    }
                    if (sequence != requestSequence || repository.identity() != receivedIdentity || dismissed) return@launch
                    render(config, receivedIdentity, bitmap)
                    progress.visibility = View.GONE
                    status.visibility = View.GONE
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (error: Exception) {
                    if (sequence != requestSequence || repository.identity() != identity || dismissed) return@launch
                    // 仅明确的连接不可达或超时允许离线；解析、TLS、HTTP 协议错误必须禁用旧码。
                    if (!canUseOfflineLink(error)) {
                        repository.clearCached(identity)
                        clearLink()
                    }
                    progress.visibility = View.GONE
                    status.setText(if (snapshot != null) R.string.app_share_offline_cached else R.string.app_share_load_failed)
                    status.visibility = View.VISIBLE
                    retry.visibility = View.VISIBLE
                }
            }
        }

        copy.setOnClickListener {
            val config = currentSnapshot() ?: return@setOnClickListener
            try {
                val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText(config.appName, config.copyText))
                if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU) {
                    PmMessage.success(activity, R.string.share_link_copied, dialog = dialog)
                }
            } catch (_: Exception) {
                PmMessage.error(activity, R.string.common_copy_failed, dialog = dialog)
            }
        }
        more.setOnClickListener {
            val config = currentSnapshot() ?: return@setOnClickListener
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, config.copyText)
            }
            try {
                activity.startActivity(Intent.createChooser(send, activity.getString(R.string.app_share_title)))
            } catch (_: ActivityNotFoundException) {
                PmMessage.warning(activity, R.string.app_share_no_target, dialog = dialog)
            }
        }
        retry.setOnClickListener { load() }
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
        val identityObserver = repository.observeIdentity {
            // SharedPreferences 回调在主线程执行，先禁用旧码再启动新身份任务。
            if (!dismissed) load()
        }
        dialog.setOnDismissListener {
            dismissed = true
            requestSequence++
            refreshJob?.cancel()
            identityObserver.close()
            activity.lifecycle.removeObserver(lifecycleObserver)
            icon.load(null)
        }
        dialog.show()
        PmMessage.register(dialog)
        load()
    }

    private fun canUseOfflineLink(error: Exception): Boolean =
        error is UnknownHostException || error is ConnectException ||
            error is NoRouteToHostException || error is SocketTimeoutException

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface AppShareEntryPoint {
        fun appShareRepository(): AppShareRepository
    }
}
