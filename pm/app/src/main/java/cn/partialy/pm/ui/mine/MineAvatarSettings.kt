package cn.partialy.pm.ui.mine

import android.content.Context
import android.net.Uri
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

enum class MineAvatarSource(internal val prefValue: String) {
    NONE(""),
    KUGOU("kg"),
    WY("wy"),
    LOCAL("local"),
    ;

    companion object {
        fun fromPref(value: String?): MineAvatarSource {
            if (value.isNullOrEmpty()) return NONE
            return entries.find { it.prefValue == value } ?: NONE
        }
    }
}

/**
 * 「我的」头像来源与本地自定义头像文件（固定文件名，多次选择覆盖同一文件）。
 */
@Singleton
class MineAvatarSettings @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    val localAvatarFile: File get() = File(context.filesDir, LOCAL_AVATAR_FILE_NAME)

    fun getSource(): MineAvatarSource =
        MineAvatarSource.fromPref(prefs.getString(KEY_SOURCE, null))

    fun setSource(source: MineAvatarSource) {
        prefs.edit().putString(KEY_SOURCE, source.prefValue).apply()
    }

    /**
     * 将用户选择的图片写入 [localAvatarFile]（覆盖旧文件）。
     * @return 是否写入成功且非空。
     */
    fun saveLocalAvatarFromUri(uri: Uri): Boolean {
        return runCatching {
            context.contentResolver.openInputStream(uri)?.use { input ->
                localAvatarFile.outputStream().use { output -> input.copyTo(output) }
            } ?: return false
            localAvatarFile.length() > 0L
        }.getOrDefault(false)
    }

    companion object {
        const val LOCAL_AVATAR_FILE_NAME: String = "pisamusic_avatar"

        private const val PREFS_NAME = "mine_avatar_settings"
        private const val KEY_SOURCE = "avatar_source"
    }
}
