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
import cn.partialy.pm.model.AndroidStartupData
import cn.partialy.pm.model.AnnouncementItem
import cn.partialy.pm.model.DeviceReportResult
import cn.partialy.pm.model.StartupAccountPayload
import cn.partialy.pm.model.UpdateInfo
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.network.config.StartupSnapshotStore
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
 * - 优先消费 [StartupSnapshotStore] 中由启动页聚合接口拉回的内存快照（零等待按需弹窗）；
 * - 若未命中快照（异常恢复等场景），自动降级回单接口兜底；
 * - 按序编排主界面启动弹窗：协议校验（仅未同意或版本变更）-> 版本升级 Sheet -> 专属消息 -> 未读公告。
 */
class MainStartupCoordinator(
    private val activity: AppCompatActivity,
    private val configManager: ConfigManager,
    private val startupSnapshotStore: StartupSnapshotStore,
    private val directMessageCoordinator: DirectMessageCoordinator,
    private val isLocalMode: () -> Boolean,
    private val showUnreadAnnouncements: suspend (List<AnnouncementItem>?) -> Unit,
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

        val snapshot = if (!isLocalMode()) startupSnapshotStore.consume() else null.also {
            startupSnapshotStore.clear()
        }

        if (snapshot != null) {
            applyStartupSnapshot(snapshot, skipStartupNotices)
            return
        }

        if (!isLocalMode()) {
            refreshAccountSessionIfNeeded()
        }

        activity.lifecycleScope.launch {
            if (!checkAgreementOnStartup()) return@launch
            if (isLocalMode()) return@launch

            if (!reportDeviceAndCheckIntercept()) return@launch
            if (!checkAndShowUpdateIfNeeded()) return@launch

            if (!skipStartupNotices && !activity.isFinishing && !activity.isDestroyed) {
                directMessageCoordinator.checkAndShow(activity, DirectMessageCheckSource.STARTUP)
                showUnreadAnnouncements(null)
            }
        }
    }

    private fun applyStartupSnapshot(snapshot: AndroidStartupData, skipStartupNotices: Boolean) {
        applyAccountPayload(snapshot.account)

        activity.lifecycleScope.launch {
            if (!checkSnapshotAgreement(snapshot)) return@launch

            if (snapshot.device.isCurrentlyLocked()) {
                if (!activity.isFinishing && !activity.isDestroyed) {
                    ServiceInterceptActivity.startForDeviceLocked(
                        activity = activity,
                        report = snapshot.device,
                        message = snapshot.device.lockedMessage(activity),
                    )
                }
                return@launch
            }

            if (!presentUpdateIfNewer(snapshot.update)) return@launch

            if (!skipStartupNotices && !activity.isFinishing && !activity.isDestroyed) {
                directMessageCoordinator.showStartupMessages(activity, snapshot.unreadMessages)
                showUnreadAnnouncements(snapshot.announcements)
            }
        }
    }

    private fun applyAccountPayload(account: StartupAccountPayload) {
        val currentSession = AccountSessionStore.read(activity)
        when (account.status) {
            "refreshed" -> {
                val refreshed = account.session ?: return
                if (!currentSession.loggedIn) return
                if (refreshed.user.id != currentSession.user.id) {
                    SyncPrefs.clearAccountState(activity)
                }
                AccountSessionStore.save(activity, refreshed)
            }

            "expired" -> {
                if (currentSession.loggedIn) {
                    SyncPrefs.clearAccountState(activity)
                    AccountSessionStore.clear(activity)
                }
            }
        }
    }

    private suspend fun checkSnapshotAgreement(snapshot: AndroidStartupData): Boolean {
        val agreement = snapshot.agreement
        val localMatches = StartupAgreementPrefs.isAgreementAccepted(activity, agreement.version)
        if (agreement.acceptedUpToDate && localMatches) {
            return true
        }
        val title = agreement.title.ifBlank { activity.getString(R.string.startup_fallback_agreement_title) }
        val content = agreement.content.ifBlank { activity.getString(R.string.startup_fallback_agreement_text) }
        return awaitAgreementDialog(title, content, agreement.version)
    }

    fun onResume() {
        appUpdateInstaller.retryPendingInstall()
    }

    fun onDestroy() {
        appUpdateInstaller.destroy()
        updateSheetHandle?.dismiss()
        updateSheetHandle = null
    }

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
        return presentUpdateIfNewer(updateInfo)
    }

    private suspend fun presentUpdateIfNewer(updateInfo: UpdateInfo): Boolean {
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
