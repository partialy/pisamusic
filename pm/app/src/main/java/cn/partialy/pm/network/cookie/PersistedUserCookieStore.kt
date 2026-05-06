package cn.partialy.pm.network.cookie

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.time.Instant
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.text.Charsets

/**
 * 持久化 Cookie：文件结构与 Node/TS 侧 `CookieData` 一致：
 * `{ "cookies": [ { "name", "value", "path", "expires" } ] }`，
 * 其中 `expires` 为 HTTP 日期字符串（与 `Date#toUTCString()` / RFC1123 一致）。
 *
 * 从 WebView 串解析时：按 `;` 分段、每段只按第一个 `=` 切分；忽略名为 `PATH` 的段（大小写不敏感）；
 * 每条 `path` 固定为 `"/"`，`expires` 为当前 UTC 加 50 年。
 *
 * 请求头仅拼接：`name=value`，多段用 `"; "` 连接（不含 path / expires）。
 *
 * 不在此类的构造函数中读盘；由 [reloadFromDisk] 在宿主就绪后触发（例如 [cn.partialy.pm.activity.MainActivity] 启动完成时），
 * 避免 Application 阶段 [Context.getFilesDir] 等尚未稳定时加载无效。
 */
class PersistedUserCookieStore(
    private val context: Context,
    private val fileName: String,
) {

    private val file: File get() = File(context.filesDir, fileName)

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = false
    }

    private val lock = Any()
    /** 按 name 去重，保留插入顺序 */
    private val entries = linkedMapOf<String, PersistedCookie>()

    fun getCookie(): String = synchronized(lock) { headerCache }

    /**
     * 从磁盘加载或重新加载 Cookie，并重建内存中的请求头（首次进入主界面及文件变更后均应调用）。
     */
    fun reloadFromDisk() {
        synchronized(lock) {
            loadFromDiskLocked()
            rebuildHeaderLocked()
        }
    }

    fun setCookie(raw: String) {
        synchronized(lock) {
            mergeRawCookieStringLocked(raw)
            saveLocked()
            rebuildHeaderLocked()
        }
    }

    fun updateFromMergedHeader(mergedHeader: String) {
        if (mergedHeader.isBlank()) return
        synchronized(lock) {
            mergeRawCookieStringLocked(mergedHeader)
            saveLocked()
            rebuildHeaderLocked()
        }
    }

    private var headerCache: String = ""

    private fun defaultExpiresUtcString(): String =
        ZonedDateTime.now(ZoneOffset.UTC).plusYears(50)
            .format(DateTimeFormatter.RFC_1123_DATE_TIME)

    /**
     * 与 TS `parseCookies` 一致：`;` 分段、trim、`=` 拆 name/value（仅第一个 `=`），跳过 PATH。
     */
    private fun mergeRawCookieStringLocked(raw: String) {
        for (part in raw.split(';')) {
            val trimmed = part.trim()
            if (trimmed.isEmpty()) continue
            val eq = trimmed.indexOf('=')
            if (eq <= 0) continue
            val name = trimmed.substring(0, eq).trim()
            val value = trimmed.substring(eq + 1).trim()
            if (name.isEmpty()) continue
            if (name.equals("PATH", ignoreCase = true)) continue
            entries[name] = PersistedCookie(
                name = name,
                value = value,
                path = DEFAULT_PATH,
                expires = defaultExpiresUtcString(),
            )
        }
    }

    private fun loadFromDiskLocked() {
        if (!file.exists() || file.length() == 0L) {
            entries.clear()
            return
        }
        val text = file.readText(Charsets.UTF_8).trimStart('\uFEFF')
        val next = linkedMapOf<String, PersistedCookie>()
        var legacyMigrated = false
        val loaded = runCatching {
            val root = json.parseToJsonElement(text).jsonObject
            when {
                "cookies" in root -> {
                    val doc = json.decodeFromJsonElement(CookieFileDto.serializer(), root)
                    for (c in doc.cookies) {
                        if (!isExpired(c.expires)) {
                            next[c.name] = PersistedCookie(
                                name = c.name,
                                value = c.value,
                                path = c.path.ifBlank { DEFAULT_PATH },
                                expires = c.expires,
                            )
                        }
                    }
                    true
                }
                "items" in root -> {
                    val legacy = json.decodeFromJsonElement(LegacyCookieFile.serializer(), root)
                    val nowMs = System.currentTimeMillis()
                    for (item in legacy.items) {
                        if (item.expiresAtEpochMillis <= nowMs) continue
                        val expStr = ZonedDateTime.ofInstant(
                            Instant.ofEpochMilli(item.expiresAtEpochMillis),
                            ZoneOffset.UTC,
                        ).format(DateTimeFormatter.RFC_1123_DATE_TIME)
                        next[item.name] = PersistedCookie(
                            name = item.name,
                            value = item.value,
                            path = DEFAULT_PATH,
                            expires = expStr,
                        )
                    }
                    legacyMigrated = true
                    true
                }
                else -> false
            }
        }.getOrElse { false }

        if (!loaded) return

        entries.clear()
        entries.putAll(next)
        if (legacyMigrated) saveLocked()
    }

    private fun saveLocked() {
        val doc = CookieFileDto(
            cookies = entries.values.map {
                CookieEntryDto(
                    name = it.name,
                    value = it.value,
                    path = it.path,
                    expires = it.expires,
                )
            },
        )
        file.writeText(json.encodeToString(CookieFileDto.serializer(), doc))
    }

    private fun rebuildHeaderLocked() {
        headerCache = entries.values
            .asSequence()
            .filter { !isExpired(it.expires) }
            .joinToString("; ") { "${it.name}=${it.value}" }
    }

    private fun isExpired(expires: String): Boolean {
        val instant = parseExpiresToInstant(expires) ?: return false
        return instant.isBefore(Instant.now())
    }

    private fun parseExpiresToInstant(expires: String): Instant? {
        val t = expires.trim()
        if (t.isEmpty()) return null
        runCatching {
            return ZonedDateTime.parse(t, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()
        }
        runCatching {
            return ZonedDateTime.parse(t, HTTP_DATE_LENIENT).toInstant()
        }
        runCatching {
            return Instant.parse(t)
        }
        return null
    }

    private data class PersistedCookie(
        val name: String,
        val value: String,
        val path: String,
        val expires: String,
    )

    @Serializable
    internal data class CookieFileDto(
        val cookies: List<CookieEntryDto> = emptyList(),
    )

    @Serializable
    internal data class CookieEntryDto(
        val name: String,
        val value: String,
        val path: String = DEFAULT_PATH,
        val expires: String,
    )

    @Serializable
    internal data class LegacyCookieFile(
        val v: Int = 1,
        val items: List<LegacyCookieItem> = emptyList(),
    )

    @Serializable
    internal data class LegacyCookieItem(
        val name: String,
        val value: String,
        val expiresAtEpochMillis: Long,
    )

    companion object {
        private const val DEFAULT_PATH = "/"

        /** 与 RFC1123 一致，显式 ENGLISH，避免部分设备默认 locale 下解析失败。 */
        private val HTTP_DATE_LENIENT: DateTimeFormatter =
            DateTimeFormatter.ofPattern("EEE, d MMM uuuu HH:mm:ss zzz", Locale.ENGLISH)
    }
}
