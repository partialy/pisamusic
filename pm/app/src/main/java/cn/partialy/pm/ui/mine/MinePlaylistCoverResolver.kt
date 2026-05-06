package cn.partialy.pm.ui.mine

import android.content.Context
import cn.partialy.pm.R
import java.io.File

/** 自建歌单封面：`local_chill` 等；自定义图为 [LOCAL_FILE_PREFIX] + 绝对路径；网络加载失败时用 [fallbackCoverRes]。 */
object MinePlaylistCoverResolver {

    /** 与内置 `local_*` 模板区分，避免被当成 drawable key。 */
    const val LOCAL_FILE_PREFIX = "local_file:"

    fun isLocalFileCover(cover: String): Boolean = cover.trim().startsWith(LOCAL_FILE_PREFIX)

    fun localFileForCover(cover: String): File? {
        if (!isLocalFileCover(cover)) return null
        val f = File(cover.trim().removePrefix(LOCAL_FILE_PREFIX))
        return f.takeIf { it.isFile && it.exists() }
    }

    fun storageValueForAbsolutePath(absolutePath: String): String =
        LOCAL_FILE_PREFIX + File(absolutePath).absolutePath

    fun pendingNewCoverFile(context: Context): File =
        File(context.cacheDir, "local_playlist_cover_pending")

    fun persistedCoverFile(context: Context, playlistId: String): File {
        val dir = File(context.filesDir, "playlist_covers")
        dir.mkdirs()
        return File(dir, playlistId)
    }

    data class LocalCoverTemplate(
        /** 存储到 [cn.partialy.pm.model.CollectedPlaylist.cover] 时为 `local_$suffix`。 */
        val suffix: String,
        val drawableRes: Int,
    )

    /** 新建歌单可选的固定封面，顺序与 UI 一排展示一致。 */
    val localCoverTemplates: List<LocalCoverTemplate> = listOf(
        LocalCoverTemplate("chill", R.drawable.playlist_cover_chill),
        LocalCoverTemplate("focus", R.drawable.playlist_cover_focus),
        LocalCoverTemplate("gaming", R.drawable.playlist_cover_gaming),
        LocalCoverTemplate("jazz", R.drawable.playlist_cover_jazz),
        LocalCoverTemplate("pop", R.drawable.playlist_cover_pop),
        LocalCoverTemplate("workout", R.drawable.playlist_cover_workout),
    )

    val fallbackCoverRes: Int = R.drawable.playlist_cover_pop

    private val localPrefix = "local_"

    fun coverStorageValue(suffix: String): String = "$localPrefix${suffix.lowercase()}"

    fun localTemplateRes(cover: String): Int? {
        val raw = cover.trim()
        if (isLocalFileCover(raw)) return null
        val key = raw.lowercase()
        if (!key.startsWith(localPrefix)) return null
        return when (key.removePrefix(localPrefix)) {
            "chill" -> R.drawable.playlist_cover_chill
            "focus" -> R.drawable.playlist_cover_focus
            "gaming" -> R.drawable.playlist_cover_gaming
            "jazz" -> R.drawable.playlist_cover_jazz
            "pop" -> R.drawable.playlist_cover_pop
            "workout" -> R.drawable.playlist_cover_workout
            else -> null
        }
    }

    /** 本地歌单无合法模板时使用。 */
    fun defaultLocalCoverRes(): Int = R.drawable.playlist_cover_chill
}
