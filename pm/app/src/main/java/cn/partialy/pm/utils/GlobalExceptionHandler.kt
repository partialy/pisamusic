package cn.partialy.pm.utils

import android.app.Activity
import android.app.Application
import android.app.Dialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.widget.Toast
import cn.partialy.pm.R
import cn.partialy.pm.fault.PlaybackFaultLog
import cn.partialy.pm.fault.PlaybackFaultRecorder
import cn.partialy.pm.fault.PlaybackFaultSanitizer
import cn.partialy.pm.fault.PlaybackFaultStore
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import org.json.JSONObject
import java.io.PrintWriter
import java.io.StringWriter
import java.lang.ref.WeakReference
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

object GlobalExceptionHandler : Thread.UncaughtExceptionHandler {
    private const val TAG = "CrashHandler"
    private const val STACK_DIALOG_MAX_HEIGHT_DP = 280

    private val mainHandler = Handler(Looper.getMainLooper())
    private val dialogShowing = AtomicBoolean(false)

    @Volatile
    private var installed = false

    @Volatile
    private var debugMode = false

    @Volatile
    private var defaultHandler: Thread.UncaughtExceptionHandler? = null

    @Volatile
    private var currentActivityRef: WeakReference<Activity>? = null

    private lateinit var appContext: Context

    fun init(application: Application, isDebug: Boolean) {
        if (installed) return
        installed = true
        debugMode = isDebug
        appContext = application.applicationContext
        defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        application.registerActivityLifecycleCallbacks(ActivityTracker)
        Thread.setDefaultUncaughtExceptionHandler(this)
        if (isDebug) installMainThreadGuard()
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        val isMainThread = thread == Looper.getMainLooper().thread
        report(thread, throwable, isMainThread)

        if (isMainThread) {
            if (debugMode) return
            defaultHandler?.uncaughtException(thread, throwable)
            return
        }

        Log.w(TAG, "Background thread exception intercepted: ${thread.name}", throwable)
    }

    private fun installMainThreadGuard() {
        mainHandler.post {
            while (true) {
                try {
                    Looper.loop()
                } catch (throwable: Throwable) {
                    report(Thread.currentThread(), throwable, isMainThread = true)
                }
            }
        }
    }

    private fun report(thread: Thread, throwable: Throwable, isMainThread: Boolean) {
        val stack = throwable.stackTraceString()
        Log.e(TAG, "Uncaught exception in thread ${thread.name}, main=$isMainThread", throwable)
        persistCrashLog(
            failureType = if (isMainThread) "uncaught_main_crash" else "uncaught_bg_crash",
            methodName = resolveCrashMethodName(throwable, thread.name),
            threadName = thread.name,
            isMainThread = isMainThread,
            throwable = throwable,
        )
        if (!::appContext.isInitialized) return
        showExceptionDialog(
            title = appContext.getString(
                if (isMainThread) R.string.debug_main_thread_exception else R.string.debug_background_exception,
            ),
            message = buildString {
                appendLine(appContext.getString(R.string.debug_thread_line, thread.name))
                appendLine(appContext.getString(R.string.debug_type_line, throwable.javaClass.name))
                appendLine(
                    appContext.getString(
                        R.string.debug_message_line,
                        throwable.localizedMessage ?: appContext.getString(R.string.debug_empty_message),
                    ),
                )
                appendLine()
                append(stack)
            },
        )
    }

    /** 记录关键业务流程中兜底捕获的异常，使其同样可在“故障上报”中提交排查。 */
    fun recordHandledException(methodName: String, throwable: Throwable) {
        val currentThread = Thread.currentThread()
        val isMainThread = currentThread == Looper.getMainLooper().thread
        Log.e(TAG, "Handled exception in $methodName", throwable)
        persistCrashLog(
            failureType = "handled_exception",
            methodName = PlaybackFaultSanitizer.limit(methodName, 128),
            threadName = currentThread.name,
            isMainThread = isMainThread,
            throwable = throwable,
        )
    }

    private fun persistCrashLog(
        failureType: String,
        methodName: String,
        threadName: String,
        isMainThread: Boolean,
        throwable: Throwable,
    ) {
        if (!::appContext.isInitialized) return
        runCatching {
            val contextJson = JSONObject()
                .put("thread", threadName)
                .put("isMainThread", isMainThread)
                .toString()
            val message = throwable.localizedMessage?.takeIf { it.isNotBlank() }
                ?: throwable.message?.takeIf { it.isNotBlank() }
                ?: throwable.javaClass.simpleName
            PlaybackFaultStore.insertSync(
                appContext,
                PlaybackFaultLog(
                    id = UUID.randomUUID().toString(),
                    scene = PlaybackFaultRecorder.SCENE_APP_CRASH,
                    failureType = failureType,
                    occurredAt = System.currentTimeMillis(),
                    methodName = methodName,
                    requestMethod = "",
                    requestUrl = "",
                    requestParamsJson = PlaybackFaultSanitizer.limit(contextJson, PlaybackFaultSanitizer.MAX_PARAMS_LENGTH),
                    nonceId = "",
                    responseCode = null,
                    responseBody = "",
                    resolvedUrl = "",
                    errorType = PlaybackFaultSanitizer.limit(throwable.javaClass.name, 256),
                    errorMessage = PlaybackFaultSanitizer.errorMessage(message),
                    stackTrace = PlaybackFaultSanitizer.stackTrace(throwable),
                    songSource = "",
                    songId = "",
                    quality = "",
                ),
            )
        }.onFailure { error ->
            Log.e(TAG, "Persist crash log failed", error)
        }
    }

    private fun resolveCrashMethodName(throwable: Throwable, threadName: String): String {
        val frames = throwable.stackTrace
        val appFrame = frames.firstOrNull { it.className.startsWith("cn.partialy.pm") } ?: frames.firstOrNull()
        val raw = if (appFrame != null) {
            val simpleClass = appFrame.className.substringAfterLast('.')
            "$simpleClass.${appFrame.methodName}:${appFrame.lineNumber}"
        } else {
            "Thread:$threadName"
        }
        return PlaybackFaultSanitizer.limit(raw, 128)
    }

    private fun showExceptionDialog(title: String, message: String) {
        mainHandler.post {
            val activity = currentActivityRef?.get()
            if (activity == null || activity.isFinishing || activity.isDestroyed) {
                dialogShowing.set(false)
                return@post
            }
            if (!dialogShowing.compareAndSet(false, true)) return@post

            runCatching {
                val dialog: Dialog = PmMinimalDialog.Builder(activity)
                    .setTitle(title)
                    .setMessage(message)
                    .setMessageGravity(Gravity.START)
                    .setMessageSelectable(true)
                    .setMessageMaxHeightDp(STACK_DIALOG_MAX_HEIGHT_DP)
                    .setCancelButton(appContext.getString(R.string.debug_close))
                    .setConfirmButton(appContext.getString(R.string.debug_copy)) {
                        copyErrorStack(activity, message)
                    }
                    .setDismissOnConfirm(false)
                    .setCancelable(true)
                    .show()
                dialog.setOnDismissListener {
                    dialogShowing.set(false)
                }
            }.onFailure { error ->
                dialogShowing.set(false)
                Log.e(TAG, "Show exception dialog failed", error)
            }
        }
    }

    private fun copyErrorStack(context: Context, message: String) {
        runCatching {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(
                ClipData.newPlainText(context.getString(R.string.debug_stack_clipboard_label), message),
            )
            // 故障降级白名单：异常处理不依赖应用内窗口组件；Android 13+ 使用系统复制反馈。
            if (android.os.Build.VERSION.SDK_INT < 33) {
                Toast.makeText(context, R.string.debug_stack_copied, Toast.LENGTH_SHORT).show()
            }
        }.onFailure {
            Log.e(TAG, "Copy exception stack failed", it)
        }
    }

    private fun Throwable.stackTraceString(): String {
        val writer = StringWriter()
        PrintWriter(writer).use { printWriter ->
            printStackTrace(printWriter)
        }
        return writer.toString()
    }

    private object ActivityTracker : Application.ActivityLifecycleCallbacks {
        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit

        override fun onActivityStarted(activity: Activity) {
            currentActivityRef = WeakReference(activity)
        }

        override fun onActivityResumed(activity: Activity) {
            currentActivityRef = WeakReference(activity)
        }

        override fun onActivityPaused(activity: Activity) = Unit

        override fun onActivityStopped(activity: Activity) = Unit

        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

        override fun onActivityDestroyed(activity: Activity) {
            if (currentActivityRef?.get() === activity) {
                currentActivityRef = null
            }
        }
    }
}
