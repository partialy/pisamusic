package cn.partialy.pm.announcement

import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonSerializationContext
import com.google.gson.JsonSerializer
import java.lang.reflect.Type
import java.net.URI
import java.util.regex.Pattern

private val HEX_COLOR_PATTERN = Pattern.compile("^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
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
    val uri = runCatching { URI(value.trim()) }.getOrNull() ?: return false
    return uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.userInfo == null
}

fun isAllowedAnnouncementProtocol(value: String): Boolean {
    val trimmed = value.trim()
    return trimmed.isNotEmpty() && PISA_PROTOCOL_PATTERN.matcher(trimmed).matches()
}

fun shouldUnderlineAnnouncementAction(action: AnnouncementAction): Boolean {
    return action is AnnouncementAction.Url || action is AnnouncementAction.Protocol ||
        action is AnnouncementAction.Page
}

fun resolveAnnouncementColor(color: String?, defaultColor: Int): Int {
    if (color.isNullOrBlank()) return defaultColor
    val trimmed = color.trim()
    val hex = COLOR_PRESET_MAP[trimmed] ?: trimmed
    if (!HEX_COLOR_PATTERN.matcher(hex).matches()) return defaultColor
    return try {
        val digits = hex.drop(1)
        val rgba = if (digits.length <= 4) digits.map { "$it$it" }.joinToString("") else digits
        val androidHex = if (rgba.length == 8) rgba.takeLast(2) + rgba.take(6) else "FF$rgba"
        androidHex.toLong(16).toInt()
    } catch (_: Exception) {
        defaultColor
    }
}

fun parseAnnouncementAction(json: JsonElement?): AnnouncementAction {
    if (json == null || !json.isJsonObject) return AnnouncementAction.None
    val obj = json.asJsonObject
    val type = obj.string("type")?.trim().orEmpty()
    val label = obj.string("label")?.trim()?.takeIf(String::isNotEmpty)

    return when (type.lowercase()) {
        "copy" -> {
            val value = obj.string("value").orEmpty()
            if (value.isNotEmpty()) AnnouncementAction.Copy(label = label ?: "复制", value = value) else AnnouncementAction.None
        }
        "url" -> {
            val url = obj.string("url")?.trim().orEmpty()
            if (isAllowedAnnouncementUrl(url)) {
                AnnouncementAction.Url(
                    label = label ?: "打开",
                    url = url,
                    openMode = AnnouncementAction.Url.OpenMode.fromString(obj.string("openMode")),
                    showHeaderBar = obj.boolean("showHeaderBar") ?: true,
                )
            } else {
                AnnouncementAction.None
            }
        }
        "page" -> {
            val page = AnnouncementAction.Page.Destination.entries.firstOrNull {
                it.wireName == obj.string("page")
            }
            if (page != null) AnnouncementAction.Page(page, label ?: "打开") else AnnouncementAction.None
        }
        "protocol" -> {
            val value = obj.string("value")?.trim().orEmpty()
            if (isAllowedAnnouncementProtocol(value)) {
                AnnouncementAction.Protocol(label = label ?: "打开", value = value)
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
    val type = obj.string("type")?.trim().orEmpty()

    return when (type.lowercase()) {
        "text" -> {
            val text = obj.string("text")
            if (!text.isNullOrEmpty()) {
                AnnouncementBlock.Text(
                    text = text,
                    bold = obj.boolean("bold") ?: false,
                    color = obj.string("color")?.trim(),
                    italic = obj.boolean("italic") ?: false,
                )
            } else {
                null
            }
        }
        "image" -> {
            val fileId = obj.string("fileId")?.trim().orEmpty()
            if (fileId.isNotEmpty()) {
                val alt = obj.string("alt")?.trim()?.ifEmpty { "公告图片" } ?: "公告图片"
                val rawUrl = obj.string("url")?.trim().orEmpty()
                val url = if (isAllowedAnnouncementUrl(rawUrl)) rawUrl else null
                AnnouncementBlock.Image(fileId = fileId, alt = alt, url = url)
            } else {
                null
            }
        }
        "highlight" -> {
            val text = obj.string("text")
            val color = obj.string("color")?.trim().orEmpty()
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
                        is AnnouncementAction.Page -> action
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

private fun JsonObject.string(key: String): String? =
    get(key)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }?.asString

private fun JsonObject.boolean(key: String): Boolean? =
    get(key)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isBoolean }?.asBoolean

class AnnouncementActionAdapter : JsonDeserializer<AnnouncementAction> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?,
    ): AnnouncementAction = parseAnnouncementAction(json)
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
                    if (block.italic) blockObj.addProperty("italic", true)
                    block.color?.let { blockObj.addProperty("color", it) }
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
                            if (!a.showHeaderBar) actionObj.addProperty("showHeaderBar", false)
                        }
                        is AnnouncementAction.Page -> {
                            actionObj.addProperty("type", "page")
                            actionObj.addProperty("label", a.label)
                            actionObj.addProperty("page", a.page.wireName)
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
