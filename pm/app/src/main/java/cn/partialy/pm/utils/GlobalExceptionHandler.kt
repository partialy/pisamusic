package cn.partialy.pm.utils

import android.util.Log

class GlobalExceptionHandler private constructor() : Thread.UncaughtExceptionHandler {
    private val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        try {
            // 改用 Log.e，日志颜色是红色的，且带有 TAG，极好过滤
            Log.e("CrashHandler", "========== 捕捉到未处理的致命异常 ==========")
            Log.e("CrashHandler", "线程: ${thread.name}")
            Log.e("CrashHandler", "异常原因: ${throwable.localizedMessage}")
            Log.e("CrashHandler", "堆栈信息: ", throwable) // 直接传 throwable，会自动打印完整堆栈
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            // 告诉系统默认处理器：好了，我记录完遗言了，你可以把进程杀掉了
            defaultHandler?.uncaughtException(thread, throwable)
        }
    }

    companion object {
        @Volatile
        private var instance: GlobalExceptionHandler? = null

        fun init() {
            instance = instance ?: synchronized(this) {
                instance ?: GlobalExceptionHandler().also { instance = it }
            }
            // 设置为默认的异常处理器
            Thread.setDefaultUncaughtExceptionHandler(instance)
        }
    }
} 