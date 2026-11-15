package cn.partialy.pm

import android.app.Application
import cn.partialy.pm.ui.message.PmMessage
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

    @Inject lateinit var loveManager: cn.partialy.pm.utils.loveUtil.LoveManager

    override fun onCreate() {
        super.onCreate()
        loveManager.preloadFromDiskAsync()
        PmMessage.init(this)
        TokenManager.init(this)
        cn.partialy.pm.network.auth.AccountSessionStore.onLibraryAccountChanged {
            cn.partialy.pm.playlistcover.PlaylistCoverWork.request(this,replace=true)
        }
        cn.partialy.pm.playlistcover.PlaylistCoverWork.request(this,replace=true)
        SettingsPrefs.applyAutoAudioCacheIfNeeded(this)
        AppCompatDelegate.setDefaultNightMode(
            SettingsPrefs.toNightMode(SettingsPrefs.getThemeMode(this)),
        )
        GlobalExceptionHandler.init(this, BuildConfig.DEBUG)
        DownloadManager.getInstance(applicationContext)
    }
}
