package cn.partialy.pm.model

import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonParser

/** Gson 绕过 Kotlin 默认构造参数时，显式兼容历史 SongInfo JSON 的 playable 缺字段。 */
fun Gson.decodeSongInfoListCompat(raw: String): List<SongInfo> = runCatching {
    val root: JsonElement = JsonParser().parse(raw)
    if (!root.isJsonArray) return@runCatching emptyList()
    root.asJsonArray.mapNotNull { element ->
        val song = fromJson(element, SongInfo::class.java) ?: return@mapNotNull null
        song.copy(playable = element.playableOrDefault())
    }
}.getOrDefault(emptyList())

/** canonical payload 可能来自旧版本，缺少 playable 时保持历史默认可播放。 */
fun payloadPlayableOrDefault(raw: String): Boolean = runCatching {
    JsonParser().parse(raw)
        .takeIf { it.isJsonObject }
        ?.playableOrDefault()
        ?: true
}.getOrDefault(true)

private fun JsonElement.playableOrDefault(): Boolean {
    if (!isJsonObject) return true
    val value = asJsonObject.get("playable") ?: return true
    return runCatching {
        when {
            value.isJsonPrimitive && value.asJsonPrimitive.isBoolean -> value.asBoolean
            value.isJsonPrimitive -> value.asString.toBooleanStrictOrNull() ?: true
            else -> true
        }
    }.getOrDefault(true)
}
