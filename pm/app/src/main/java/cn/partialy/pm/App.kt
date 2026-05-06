package cn.partialy.pm

import android.app.Application
import android.util.Log
import androidx.appcompat.app.AppCompatDelegate
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.utils.DownloadManager
import cn.partialy.pm.utils.GlobalExceptionHandler
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class App : Application() {

    @Inject
    lateinit var configManager: ConfigManager

    override fun onCreate() {
        super.onCreate()
        SettingsPrefs.applyAutoAudioCacheIfNeeded(this)
        AppCompatDelegate.setDefaultNightMode(
            SettingsPrefs.toNightMode(SettingsPrefs.getThemeMode(this)),
        )
        // 初始化全局异常捕获
        GlobalExceptionHandler.init()

        // 初始化下载管理器
        DownloadManager.getInstance(applicationContext)

        // 设置全局异常捕获
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            Log.e("Application", "Uncaught exception in thread ${thread.name}", throwable)
            println("Uncaught exception in thread ${thread.name}: ${throwable.message}")
        }
    }
} 