package cn.partialy.pm.announcement

import android.graphics.Color
import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonSerializationContext
import com.google.gson.JsonSerializer
import java.lang.reflect.Type
import java.util.regex.Pattern

private val HEX_COLOR_PATTERN = Pattern.compile("^#[0-9a-fA-F]{3,8}$")
private val HTTPS_URL_PATTERN = Pattern.compile("^https://\\S+$", Pattern.CASE_INSENSITIVE)
private val PISA_PROTOCOL_PATTERN = Pattern.compile(
    "^pisamusic://[A-Za-z0-9][A-Za-z0-9._~:/?#\\[\\]@!$&'()*+,;=%-]*$",
    Pattern.CASE_INSENSITIVE,
)

private val COLOR_PRESET_MAP = mapOf(
    "neutral" to "#475569",
    "primary" to "#4f46e5",
    "info" to "#0284c7",
    "success" to "#059669",
    "warning" to "#d97706",
    "danger" to "#e11d48",
)

fun isAllowedAnnouncementUrl(value: String): Boolean {
    val trimmed = value.trim()
    return trimmed.isNotEmpty() && HTTPS_URL_PATTERN.matcher(trimmed).matches()
}

fun isAllowedAnnouncementProtocol(value: String): Boolean {
    val trimmed = value.trim()
    return trimmed.isNotEmpty() && PISA_PROTOCOL_PATTERN.matcher(trimmed).matches()
}

fun shouldUnderlineAnnouncementAction(action: AnnouncementAction): Boolean {
    return action is AnnouncementAction.Url || action is AnnouncementAction.Protocol
}

fun resolveAnnouncementColor(color: String?, defaultColor: Int): Int {
    if (color.isNullOrBlank()) return defaultColor
    val trimmed = color.trim()
    val hex = COLOR_PRESET_MAP[trimmed] ?: trimmed
    if (!HEX_COLOR_PATTERN.matcher(hex).matches()) return defaultColor
    return try {
        var s = hex
        if (s.startsWith("#")) s = s.substring(1)
        when (s.length) {
            3 -> {
                val r = s.substring(0, 1).repeat(2).toInt(16)
                val g = s.substring(1, 2).repeat(2).toInt(16)
                val b = s.substring(2, 3).repeat(2).toInt(16)
                (0xFF shl 24) or (r shl 16) or (g shl 8) or b
            }
            4 -> {
                val a = s.substring(0, 1).repeat(2).toInt(16)
                val r = s.substring(1, 2).repeat(2).toInt(16)
                val g = s.substring(2, 3).repeat(2).toInt(16)
                val b = s.substring(3, 4).repeat(2).toInt(16)
                (a shl 24) or (r shl 16) or (g shl 8) or b
            }
            6 -> {
                val rgb = s.toLong(16)
                (0xFF000000L or rgb).toInt()
            }
            8 -> {
                s.toLong(16).toInt()
            }
            else -> defaultColor
        }
    } catch (_: Exception) {
        defaultColor
    }
}

fun parseAnnouncementAction(json: JsonElement?): AnnouncementAction {
    if (json == null || !json.isJsonObject) return AnnouncementAction.None
    val obj = json.asJsonObject
    val type = obj.get("type")?.asString?.trim().orEmpty()
    val label = obj.get("label")?.asString?.trim()?.ifEmpty { null } ?: "打开"

    return when (type.lowercase()) {
        "copy" -> {
            val value = obj.get("value")?.asString.orEmpty()
            if (value.isNotEmpty()) AnnouncementAction.Copy(label = label.ifEmpty { "复制" }, value = value) else AnnouncementAction.None
        }
        "url" -> {
            val url = obj.get("url")?.asString?.trim().orEmpty()
            if (isAllowedAnnouncementUrl(url)) {
                val openMode = AnnouncementAction.Url.OpenMode.fromString(obj.get("openMode")?.asString)
                AnnouncementAction.Url(label = label, url = url, openMode = openMode)
            } else {
                AnnouncementAction.None
            }
        }
        "protocol" -> {
            val value = obj.get("value")?.asString?.trim().orEmpty()
            if (isAllowedAnnouncementProtocol(value)) {
                AnnouncementAction.Protocol(label = label, value = value)
            } else {
                AnnouncementAction.None
            }
        }
        else -> AnnouncementAction.None
    }
}

fun parseAnnouncementBlock(json: JsonElement?): AnnouncementBlock? {
    if (json == null || !json.isJsonObject) return null
    val obj = json.asJsonObject
    val type = obj.get("type")?.asString?.trim().orEmpty()

    return when (type.lowercase()) {
        "text" -> {
            val text = obj.get("text")?.asString
            if (!text.isNullOrEmpty()) {
                val bold = obj.get("bold")?.asBoolean ?: false
                AnnouncementBlock.Text(text = text, bold = bold)
            } else {
                null
            }
        }
        "image" -> {
            val fileId = obj.get("fileId")?.asString?.trim().orEmpty()
            if (fileId.isNotEmpty()) {
                val alt = obj.get("alt")?.asString?.trim()?.ifEmpty { "公告图片" } ?: "公告图片"
                val rawUrl = obj.get("url")?.asString?.trim().orEmpty()
                val url = if (isAllowedAnnouncementUrl(rawUrl)) rawUrl else null
                AnnouncementBlock.Image(fileId = fileId, alt = alt, url = url)
            } else {
                null
            }
        }
        "highlight" -> {
            val text = obj.get("text")?.asString
            val color = obj.get("color")?.asString?.trim().orEmpty()
            if (!text.isNullOrEmpty() && color.isNotEmpty()) {
                val action = parseAnnouncementAction(obj.get("action"))
                AnnouncementBlock.Highlight(color = color, text = text, action = action)
            } else {
                null
            }
        }
        else -> null
    }
}

fun parseAnnouncementContent(raw: AnnouncementContent): AnnouncementContent {
    if (raw.schemaVersion != 1) {
        return AnnouncementContent(schemaVersion = 1, blocks = listOf(AnnouncementBlock.Text("暂无公告")))
    }
    val filtered = raw.blocks.mapNotNull { block ->
        when (block) {
            is AnnouncementBlock.Text -> {
                if (block.text.isNotEmpty()) block else null
            }
            is AnnouncementBlock.Image -> {
                if (block.fileId.isNotEmpty()) {
                    val validUrl = block.url?.takeIf { isAllowedAnnouncementUrl(it) }
                    block.copy(url = validUrl)
                } else null
            }
            is AnnouncementBlock.Highlight -> {
                if (block.text.isNotEmpty()) {
                    val sanitizedAction = when (val action = block.action) {
                        is AnnouncementAction.Url -> if (isAllowedAnnouncementUrl(action.url)) action else AnnouncementAction.None
                        is AnnouncementAction.Protocol -> if (isAllowedAnnouncementProtocol(action.value)) action else AnnouncementAction.None
                        is AnnouncementAction.Copy -> if (action.value.isNotEmpty()) action else AnnouncementAction.None
                        AnnouncementAction.None -> AnnouncementAction.None
                    }
                    block.copy(action = sanitizedAction)
                } else null
            }
        }
    }
    return if (filtered.isNotEmpty()) {
        AnnouncementContent(schemaVersion = 1, blocks = filtered)
    } else {
        AnnouncementContent(schemaVersion = 1, blocks = listOf(AnnouncementBlock.Text("暂无公告")))
    }
}

fun announcementPreview(content: AnnouncementContent): String {
    val normalized = parseAnnouncementContent(content)
    val sb = StringBuilder()
    for (block in normalized.blocks) {
        when (block) {
            is AnnouncementBlock.Text -> sb.append(block.text)
            is AnnouncementBlock.Highlight -> sb.append(block.text)
            is AnnouncementBlock.Image -> sb.append("【图片】")
        }
    }
    val result = sb.toString().replace("\r\n", "\n").trim()
    return result.ifEmpty { "暂无公告" }
}

class AnnouncementContentAdapter : JsonDeserializer<AnnouncementContent>, JsonSerializer<AnnouncementContent> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?,
    ): AnnouncementContent {
        if (json == null || !json.isJsonObject) {
            return AnnouncementContent(schemaVersion = 1, blocks = listOf(AnnouncementBlock.Text("暂无公告")))
        }
        val obj = json.asJsonObject
        val schemaVersion = obj.get("schemaVersion")?.asInt ?: 1
        if (schemaVersion != 1) {
            return AnnouncementContent(schemaVersion = 1, blocks = listOf(AnnouncementBlock.Text("暂无公告")))
        }
        val blocksArray = obj.getAsJsonArray("blocks")
        if (blocksArray == null || blocksArray.size() == 0) {
            return AnnouncementContent(schemaVersion = 1, blocks = listOf(AnnouncementBlock.Text("暂无公告")))
        }
        val blocks = mutableListOf<AnnouncementBlock>()
        for (element in blocksArray) {
            parseAnnouncementBlock(element)?.let { blocks.add(it) }
        }
        return if (blocks.isNotEmpty()) {
            AnnouncementContent(schemaVersion = 1, blocks = blocks)
        } else {
            AnnouncementContent(schemaVersion = 1, blocks = listOf(AnnouncementBlock.Text("暂无公告")))
        }
    }

    override fun serialize(
        src: AnnouncementContent?,
        typeOfSrc: Type?,
        context: JsonSerializationContext?,
    ): JsonElement {
        val root = JsonObject()
        root.addProperty("schemaVersion", src?.schemaVersion ?: 1)
        val array = com.google.gson.JsonArray()
        src?.blocks?.forEach { block ->
            val blockObj = JsonObject()
            when (block) {
                is AnnouncementBlock.Text -> {
                    blockObj.addProperty("type", "text")
                    blockObj.addProperty("text", block.text)
                    if (block.bold) blockObj.addProperty("bold", true)
                }
                is AnnouncementBlock.Image -> {
                    blockObj.addProperty("type", "image")
                    blockObj.addProperty("fileId", block.fileId)
                    blockObj.addProperty("alt", block.alt)
                    block.url?.let { blockObj.addProperty("url", it) }
                }
                is AnnouncementBlock.Highlight -> {
                    blockObj.addProperty("type", "highlight")
                    blockObj.addProperty("color", block.color)
                    blockObj.addProperty("text", block.text)
                    val actionObj = JsonObject()
                    when (val a = block.action) {
                        AnnouncementAction.None -> actionObj.addProperty("type", "none")
                        is AnnouncementAction.Copy -> {
                            actionObj.addProperty("type", "copy")
                            actionObj.addProperty("label", a.label)
                            actionObj.addProperty("value", a.value)
                        }
                        is AnnouncementAction.Url -> {
                            actionObj.addProperty("type", "url")
                            actionObj.addProperty("label", a.label)
                            actionObj.addProperty("url", a.url)
                            actionObj.addProperty("openMode", if (a.openMode == AnnouncementAction.Url.OpenMode.APP) "app" else "browser")
                        }
                        is AnnouncementAction.Protocol -> {
                            actionObj.addProperty("type", "protocol")
                            actionObj.addProperty("label", a.label)
                            actionObj.addProperty("value", a.value)
                        }
                    }
                    blockObj.add("action", actionObj)
                }
            }
            array.add(blockObj)
        }
        root.add("blocks", array)
        return root
    }
}
