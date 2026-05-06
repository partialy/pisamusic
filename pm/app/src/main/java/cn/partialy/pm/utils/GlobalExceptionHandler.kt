package cn.partialy.pm.utils

class GlobalExceptionHandler private constructor() : Thread.UncaughtExceptionHandler {
    private val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        try {
            // 打印异常信息到控制台
            println("========== 发生异常 ==========")
            println("线程: ${thread.name}")
            println("异常信息: ${throwable.message}")
            println("异常堆栈:")
            throwable.printStackTrace()
            println("============================")

            // 如果是调试模式，等待一会儿让日志完全打印
            Thread.sleep(1000)
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            // 调用系统默认的异常处理器
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