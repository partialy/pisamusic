package cn.partialy.pm

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import cn.partialy.pm.network.auth.TokenManager
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
        TokenManager.init(this)
        SettingsPrefs.applyAutoAudioCacheIfNeeded(this)
        AppCompatDelegate.setDefaultNightMode(
            SettingsPrefs.toNightMode(SettingsPrefs.getThemeMode(this)),
        )
        GlobalExceptionHandler.init(this, BuildConfig.DEBUG)
        DownloadManager.getInstance(applicationContext)
    }
}
