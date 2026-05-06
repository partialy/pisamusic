package cn.partialy.pm.network.cookie

import android.content.Context
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/** 导入歌单登录账号在侧栏与「我的」背景的缓存（JSON 落盘）。 */
data class DrawerImportProfileCache(
    val savedAtMillis: Long,
    val kgNickname: String? = null,
    val kgAvatarUrl: String? = null,
    val wyNickname: String? = null,
    val wyAvatarUrl: String? = null,
    val wyBackgroundUrl: String? = null,
)

@Singleton
class DrawerImportProfileCacheStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val gson = Gson()
    private val file = File(context.filesDir, "drawer_import_profile_cache.json")

    fun read(): DrawerImportProfileCache? {
        if (!file.exists() || file.length() == 0L) return null
        return runCatching { gson.fromJson(file.readText(), DrawerImportProfileCache::class.java) }.getOrNull()
    }

    fun write(cache: DrawerImportProfileCache) {
        file.writeText(gson.toJson(cache))
    }

    companion object {
        const val REFRESH_INTERVAL_MS: Long = 24L * 60 * 60 * 1000
    }
}
