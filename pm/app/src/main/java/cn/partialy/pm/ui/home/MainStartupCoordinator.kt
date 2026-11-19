package cn.partialy.pm.ui.home

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.activity.ServiceInterceptActivity
import cn.partialy.pm.directmessage.DirectMessageCheckSource
import cn.partialy.pm.directmessage.DirectMessageCoordinator
import cn.partialy.pm.model.DeviceReportResult
import cn.partialy.pm.model.UpdateInfo
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.sync.SyncPrefs
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.SplashActionBottomSheet
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.util.DeviceInfoCollector
import cn.partialy.pm.utils.AppUpdateInstaller
import cn.partialy.pm.utils.AppVersionComparator
import cn.partialy.pm.utils.ServerDevicePrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume

/**
 * 主界面启动任务与按需弹窗协调器：
 * - 后台静默刷新系统账号 Token；
 * - 按需校验用户协议（首次未同意或服务端协议版本更新时弹窗）；
 * - 上报设备信息并校验设备封禁 / 服务停用（-233），触发时立即跳转 [ServiceInterceptActivity]；
 * - 按序编排主界面启动弹窗：版本升级 Sheet -> 专属消息 -> 未读公告。
 */
class MainStartupCoordinator(
    private val activity: AppCompatActivity,
    private val configManager: ConfigManager,
    private val directMessageCoordinator: DirectMessageCoordinator,
    private val isLocalMode: () -> Boolean,
    private val showUnreadAnnouncements: suspend () -> Unit,
) {
    private var startupTriggered = false
    private var latestDownloadUrl: String = ""
    private var latestOfficialUrl: String = ""
    private var updateSheetHandle: SplashActionBottomSheet.Handle? = null

    private val appUpdateInstaller = AppUpdateInstaller(
        activity = activity,
        callbacks = object : AppUpdateInstaller.Callbacks {
            override fun onDownloadProgress(downloading: Boolean, progress: Int, text: String) {
                activity.runOnUiThread {
                    updateSheetHandle?.updateDownloadProgress(downloading, progress, text)
                }
            }

            override fun onError(message: String) {
                showStartupErrorDialog(message)
            }

            override fun onMessage(message: String) {
                PmMessage.info(activity, message)
            }
        },
    )

    fun startIfNeeded(savedInstanceState: Bundle?, skipStartupNotices: Boolean) {
        if (savedInstanceState != null || startupTriggered) return
        startupTriggered = true

        if (!isLocalMode()) {
            activity.lifecycleScope.launch(Dispatchers.IO) {
                refreshAccountSessionIfNeeded()
            }
        }

        activity.lifecycleScope.launch {
            if (!checkAgreementOnStartup()) return@launch
            if (isLocalMode()) return@launch

            if (!reportDeviceAndCheckIntercept()) return@launch
            if (!checkAndShowUpdateIfNeeded()) return@launch

            if (!skipStartupNotices && !activity.isFinishing && !activity.isDestroyed) {
                directMessageCoordinator.checkAndShow(activity, DirectMessageCheckSource.STARTUP)
                showUnreadAnnouncements()
            }
        }
    }

    fun onResume() {
        appUpdateInstaller.retryPendingInstall()
    }

    fun onDestroy() {
        appUpdateInstaller.destroy()
        updateSheetHandle?.dismiss()
        updateSheetHandle = null
    }

    /**
     * 校验用户协议：
     * - 本地未同意过：阻塞等待协议弹窗确认后再继续；
     * - 本地已同意过：在线校验版本号，仅当服务端协议版本变更时补弹确认框。
     * @return true 表示可继续后续启动流程；false 表示已跳转拦截页或退出。
     */
    private suspend fun checkAgreementOnStartup(): Boolean {
        val localAcceptedAny = StartupAgreementPrefs.isAgreementAccepted(activity)
        if (isLocalMode()) {
            if (!localAcceptedAny) {
                return awaitAgreementDialog(
                    title = activity.getString(R.string.startup_fallback_agreement_title),
                    content = activity.getString(R.string.startup_fallback_agreement_text),
                    version = StartupAgreementPrefs.DEFAULT_AGREEMENT_VERSION,
                )
            }
            return true
        }

        val agreementResult = runCatching {
            withContext(Dispatchers.IO) {
                configManager.getAgreementInfo()
            }
        }
        return agreementResult.fold(
            onSuccess = { info ->
                if (!StartupAgreementPrefs.isAgreementAccepted(activity, info.version)) {
                    awaitAgreementDialog(info.title, info.content, info.version)
                } else {
                    true
                }
            },
            onFailure = { error ->
                if (error.isServiceUnavailable()) {
                    navigateToServiceUnavailableIntercept(error)
                    false
                } else if (!localAcceptedAny) {
                    awaitAgreementDialog(
                        title = activity.getString(R.string.startup_fallback_agreement_title),
                        content = activity.getString(R.string.startup_fallback_agreement_text),
                        version = StartupAgreementPrefs.DEFAULT_AGREEMENT_VERSION,
                    )
                } else {
                    true
                }
            },
        )
    }

    private suspend fun awaitAgreementDialog(
        title: String,
        content: String,
        version: Long,
    ): Boolean = suspendCancellableCoroutine { cont ->
        if (activity.isFinishing || activity.isDestroyed) {
            if (cont.isActive) cont.resume(false)
            return@suspendCancellableCoroutine
        }
        val dialog = PmMinimalDialog.show(
            context = activity,
            title = title,
            message = content,
            cancelText = activity.getString(R.string.startup_agreement_exit),
            confirmText = activity.getString(R.string.startup_agreement_accept),
            cancelColor = ContextCompat.getColor(activity, R.color.pm_dialog_danger),
            confirmColor = ContextCompat.getColor(activity, R.color.pm_dialog_confirm),
            widthDp = 340,
            messageGravity = Gravity.START,
            messageSelectable = true,
            messageMaxHeightDp = 420,
            cancelable = false,
            onCancel = {
                if (cont.isActive) cont.resume(false)
                activity.finishAffinity()
            },
            onConfirm = {
                StartupAgreementPrefs.setAgreementAccepted(activity, true, version)
                if (cont.isActive) cont.resume(true)
            },
        )
        cont.invokeOnCancellation {
            if (dialog.isShowing) dialog.dismiss()
        }
    }

    /**
     * 上报设备信息并检查封禁 / 服务停用状态。
     * @return true 表示正常可继续；false 表示已触发拦截跳转。
     */
    private suspend fun reportDeviceAndCheckIntercept(): Boolean {
        val reportResult = runCatching {
            withContext(Dispatchers.IO) {
                val body = DeviceInfoCollector.build(activity)
                configManager.reportDevice(body)
            }
        }
        return reportResult.fold(
            onSuccess = { report ->
                ServerDevicePrefs.saveReportIdentity(activity, report.id, report.messageToken)
                if (report.isCurrentlyLocked()) {
                    if (!activity.isFinishing && !activity.isDestroyed) {
                        ServiceInterceptActivity.startForDeviceLocked(
                            activity = activity,
                            report = report,
                            message = report.lockedMessage(activity),
                        )
                    }
                    false
                } else {
                    true
                }
            },
            onFailure = { error ->
                if (error.isServiceUnavailable()) {
                    navigateToServiceUnavailableIntercept(error)
                    false
                } else {
                    true
                }
            },
        )
    }

    /**
     * 检查版本更新并在需要时弹出升级 Sheet。
     * @return true 表示无需更新或用户已跳过非强制更新；false 表示触发拦截或强制更新阻塞。
     */
    private suspend fun checkAndShowUpdateIfNeeded(): Boolean {
        val updateResult = runCatching {
            withContext(Dispatchers.IO) {
                configManager.getUpdateInfo()
            }
        }
        val updateInfo = updateResult.getOrElse { error ->
            if (error.isServiceUnavailable()) {
                navigateToServiceUnavailableIntercept(error)
                return false
            }
            return true
        }

        val localVersion = activity.packageManager.getPackageInfo(activity.packageName, 0).versionName.orEmpty()
        val shouldPromptUpdate = !BuildConfig.DEBUG &&
            AppVersionComparator.isServerVersionNewer(localVersion, updateInfo.latestVersion)
        if (!shouldPromptUpdate) return true

        return awaitUpdateSheet(updateInfo)
    }

    private suspend fun awaitUpdateSheet(initialInfo: UpdateInfo): Boolean =
        suspendCancellableCoroutine { cont ->
            if (activity.isFinishing || activity.isDestroyed) {
                if (cont.isActive) cont.resume(false)
                return@suspendCancellableCoroutine
            }

            fun presentSheet(info: UpdateInfo) {
                latestDownloadUrl = info.downloadUrl
                latestOfficialUrl = info.officialUrl
                updateSheetHandle?.dismiss()
                updateSheetHandle = SplashActionBottomSheet.showUpdate(
                    activity = activity,
                    latestVersion = info.latestVersion,
                    updateTime = info.updateTime,
                    updateContent = info.updateContent,
                    forceUpdate = info.forceUpdate,
                    onUpdateClick = {
                        appUpdateInstaller.startDownload(latestDownloadUrl)
                    },
                    onOfficialClick = {
                        openOfficialSite()
                    },
                    onSkipClick = {
                        activity.lifecycleScope.launch {
                            val latestCheck = runCatching {
                                withContext(Dispatchers.IO) { configManager.getUpdateInfo() }
                            }
                            latestCheck.fold(
                                onSuccess = { latest ->
                                    val localVersion = activity.packageManager
                                        .getPackageInfo(activity.packageName, 0).versionName.orEmpty()
                                    val stillNewer = !BuildConfig.DEBUG &&
                                        AppVersionComparator.isServerVersionNewer(localVersion, latest.latestVersion)
                                    if (stillNewer && latest.forceUpdate) {
                                        presentSheet(latest.copy(forceUpdate = true))
                                        return@fold
                                    }
                                    updateSheetHandle?.dismiss()
                                    updateSheetHandle = null
                                    if (cont.isActive) cont.resume(true)
                                },
                                onFailure = { err ->
                                    if (err.isServiceUnavailable()) {
                                        updateSheetHandle?.dismiss()
                                        updateSheetHandle = null
                                        navigateToServiceUnavailableIntercept(err)
                                        if (cont.isActive) cont.resume(false)
                                        return@fold
                                    }
                                    updateSheetHandle?.dismiss()
                                    updateSheetHandle = null
                                    if (cont.isActive) cont.resume(true)
                                },
                            )
                        }
                    },
                )
            }

            presentSheet(initialInfo)
            cont.invokeOnCancellation {
                updateSheetHandle?.dismiss()
                updateSheetHandle = null
            }
        }

    private fun refreshAccountSessionIfNeeded() {
        val session = AccountSessionStore.read(activity)
        if (!session.loggedIn) return
        activity.lifecycleScope.launch(Dispatchers.IO) {
            runCatching {
                configManager.refreshAccountToken(session.token)
            }.onSuccess { refreshed ->
                if (AccountSessionStore.read(activity).token != session.token) return@onSuccess
                if (refreshed.user.id != session.user.id) {
                    SyncPrefs.clearAccountState(activity)
                }
                AccountSessionStore.save(activity, refreshed)
            }.onFailure { error ->
                if (AccountSessionStore.read(activity).token != session.token) return@onFailure
                if (error.isAccountAuthExpired()) {
                    SyncPrefs.clearAccountState(activity)
                    AccountSessionStore.clear(activity)
                }
            }
        }
    }

    private fun openOfficialSite() {
        val url = latestOfficialUrl.trim()
        if (url.isEmpty()) {
            showStartupErrorDialog(activity.getString(R.string.startup_official_url_empty))
            return
        }
        runCatching {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    private fun showStartupErrorDialog(message: String) {
        if (activity.isFinishing || activity.isDestroyed) return
        PmMinimalDialog.show(
            context = activity,
            title = activity.getString(R.string.startup_error_title),
            message = message,
            confirmText = activity.getString(R.string.dialog_ok),
            singleButton = true,
            cancelable = false,
            onConfirm = { activity.finishAffinity() },
        )
    }

    private fun navigateToServiceUnavailableIntercept(error: Throwable) {
        if (activity.isFinishing || activity.isDestroyed) return
        val apiError = error as? ConfigManager.ApiException
        ServiceInterceptActivity.startForServiceUnavailable(
            activity = activity,
            message = error.message ?: activity.getString(R.string.startup_unavailable_title),
            code = apiError?.code ?: -233,
        )
    }

    companion object {
        internal fun Throwable.isServiceUnavailable(): Boolean {
            val apiError = this as? ConfigManager.ApiException ?: return false
            return apiError.code == -233
        }

        internal fun Throwable.isAccountAuthExpired(): Boolean {
            val apiError = this as? ConfigManager.ApiException ?: return false
            return apiError.httpStatus == 401 || apiError.code == 401
        }

        internal fun DeviceReportResult.isCurrentlyLocked(
            nowMillis: Long = System.currentTimeMillis(),
        ): Boolean {
            if (!locked) return false
            val endTime = lockEndTime ?: return true
            return endTime > nowMillis
        }

        internal fun DeviceReportResult.lockedMessage(context: Context): String {
            val endTime = lockEndTime ?: return context.getString(R.string.startup_device_banned)
            val formatted = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(endTime))
            return context.getString(R.string.startup_device_banned_until, formatted)
        }
    }
}
