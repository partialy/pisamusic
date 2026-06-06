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
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import java.io.PrintWriter
import java.io.StringWriter
import java.lang.ref.WeakReference
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

    fun init(application: Application, isDebug: Boolean) {
        if (installed) return
        installed = true
        debugMode = isDebug
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
        showExceptionDialog(
            title = if (isMainThread) "捕获到主线程异常" else "捕获到后台异常",
            message = buildString {
                appendLine("线程：${thread.name}")
                appendLine("类型：${throwable.javaClass.name}")
                appendLine("信息：${throwable.localizedMessage ?: "无"}")
                appendLine()
                append(stack)
            },
        )
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
                    .setCancelButton("关闭")
                    .setConfirmButton("复制") {
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
            clipboard.setPrimaryClip(ClipData.newPlainText("PisaMusic 异常堆栈", message))
            Toast.makeText(context, "错误堆栈已复制", Toast.LENGTH_SHORT).show()
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
