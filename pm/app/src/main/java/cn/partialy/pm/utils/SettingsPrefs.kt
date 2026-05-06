package cn.partialy.pm.utils

import android.content.Context
import android.os.Environment
import android.os.StatFs
import androidx.appcompat.app.AppCompatDelegate

object SettingsPrefs {
    private const val PREFS_NAME = "user_settings"

    private const val KEY_FILE_NAMING_RULE = "file_naming_rule"
    private const val KEY_WRITE_COVER = "write_cover"
    private const val KEY_WRITE_TAGS = "write_tags"
    private const val KEY_WRITE_LYRICS = "write_lyrics"
    private const val KEY_THEME_MODE = "theme_mode"
    private const val KEY_PLAY_MODE = "play_mode"
    private const val KEY_AUDIO_CACHE_MAX_MB = "audio_cache_max_mb"
    private const val KEY_AUDIO_CACHE_MODE = "audio_cache_mode"

    private const val DEFAULT_AUDIO_CACHE_MAX_MB = 2048L
    private const val MIN_AUDIO_CACHE_MAX_MB = 100L
    private const val MAX_AUDIO_CACHE_MAX_MB = 20_480L

    enum class FileNamingRule(val prefValue: Int) {
        TitleDashArtist(0),
        ArtistDashTitle(1),
    }

    enum class ThemeMode(val prefValue: Int) {
        System(0),
        Light(1),
        Dark(2),
    }

    enum class PlayMode(val prefValue: Int) {
        /** 顺序播放（列表循环） */
        Order(0),
        /** 随机播放（列表循环） */
        Shuffle(1),
        /** 单曲循环（循环当前曲目） */
        Single(2),
    }

    enum class AudioCacheMode(val prefValue: Int) {
        Manual(0),
        Auto(1),
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getFileNamingRule(context: Context): FileNamingRule {
        val v = prefs(context).getInt(KEY_FILE_NAMING_RULE, FileNamingRule.ArtistDashTitle.prefValue)
        return FileNamingRule.values().firstOrNull { it.prefValue == v } ?: FileNamingRule.ArtistDashTitle
    }

    fun setFileNamingRule(context: Context, rule: FileNamingRule) {
        prefs(context).edit().putInt(KEY_FILE_NAMING_RULE, rule.prefValue).apply()
    }

    fun isWriteCoverEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_WRITE_COVER, true)

    fun setWriteCoverEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_WRITE_COVER, enabled).apply()
    }

    fun isWriteTagsEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_WRITE_TAGS, true)

    fun setWriteTagsEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_WRITE_TAGS, enabled).apply()
    }

    fun isWriteLyricsEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_WRITE_LYRICS, true)

    fun setWriteLyricsEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_WRITE_LYRICS, enabled).apply()
    }

    fun getThemeMode(context: Context): ThemeMode {
        val v = prefs(context).getInt(KEY_THEME_MODE, ThemeMode.System.prefValue)
        return ThemeMode.values().firstOrNull { it.prefValue == v } ?: ThemeMode.System
    }

    fun setThemeMode(context: Context, mode: ThemeMode) {
        prefs(context).edit().putInt(KEY_THEME_MODE, mode.prefValue).apply()
    }

    fun toNightMode(mode: ThemeMode): Int = when (mode) {
        ThemeMode.System -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
        ThemeMode.Light -> AppCompatDelegate.MODE_NIGHT_NO
        ThemeMode.Dark -> AppCompatDelegate.MODE_NIGHT_YES
    }

    fun getPlayMode(context: Context): PlayMode {
        val v = prefs(context).getInt(KEY_PLAY_MODE, PlayMode.Order.prefValue)
        return PlayMode.values().firstOrNull { it.prefValue == v } ?: PlayMode.Order
    }

    fun setPlayMode(context: Context, mode: PlayMode) {
        prefs(context).edit().putInt(KEY_PLAY_MODE, mode.prefValue).apply()
    }

    fun getAudioCacheMaxMb(context: Context): Long {
        val value = prefs(context).getLong(KEY_AUDIO_CACHE_MAX_MB, DEFAULT_AUDIO_CACHE_MAX_MB)
        return value.coerceIn(MIN_AUDIO_CACHE_MAX_MB, MAX_AUDIO_CACHE_MAX_MB)
    }

    fun getAudioCacheMaxBytes(context: Context): Long =
        getAudioCacheMaxMb(context) * 1024L * 1024L

    fun setAudioCacheMaxMb(context: Context, valueMb: Long) {
        val safeValue = valueMb.coerceIn(MIN_AUDIO_CACHE_MAX_MB, MAX_AUDIO_CACHE_MAX_MB)
        prefs(context).edit().putLong(KEY_AUDIO_CACHE_MAX_MB, safeValue).apply()
    }

    fun getAudioCacheMode(context: Context): AudioCacheMode {
        val value = prefs(context).getInt(KEY_AUDIO_CACHE_MODE, AudioCacheMode.Manual.prefValue)
        return AudioCacheMode.values().firstOrNull { it.prefValue == value } ?: AudioCacheMode.Manual
    }

    fun setAudioCacheMode(context: Context, mode: AudioCacheMode) {
        prefs(context).edit().putInt(KEY_AUDIO_CACHE_MODE, mode.prefValue).apply()
    }

    fun computeAutoAudioCacheMb(): Long {
        val availableBytes = runCatching {
            val path = Environment.getExternalStorageDirectory().absolutePath
            val stat = StatFs(path)
            stat.availableBlocksLong * stat.blockSizeLong
        }.getOrDefault(0L)
        val targetBytes = (availableBytes / 10.0).toLong()
        val targetMb = targetBytes / (1024L * 1024L)
        return targetMb.coerceIn(MIN_AUDIO_CACHE_MAX_MB, MAX_AUDIO_CACHE_MAX_MB)
    }

    fun applyAutoAudioCacheIfNeeded(context: Context): Boolean {
        if (getAudioCacheMode(context) != AudioCacheMode.Auto) return false
        setAudioCacheMaxMb(context, computeAutoAudioCacheMb())
        return true
    }

    fun getAudioCacheMinMb(): Long = MIN_AUDIO_CACHE_MAX_MB

    fun getAudioCacheMaxMbLimit(): Long = MAX_AUDIO_CACHE_MAX_MB

    fun getAudioCacheDefaultMb(): Long = DEFAULT_AUDIO_CACHE_MAX_MB
}

