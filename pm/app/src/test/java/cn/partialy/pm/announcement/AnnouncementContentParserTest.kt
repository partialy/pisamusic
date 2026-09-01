package cn.partialy.pm.announcement

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AnnouncementContentParserTest {

    private lateinit var gson: Gson

    @Before
    fun setUp() {
        gson = GsonBuilder()
            .registerTypeAdapter(AnnouncementContent::class.java, AnnouncementContentAdapter())
            .create()
    }

    @Test
    fun `deserialize structured json correctly`() {
        val json = """
            {
              "schemaVersion": 1,
              "blocks": [
                { "type": "text", "text": "欢迎使用 PisaMusic！", "bold": true },
                { "type": "highlight", "text": "官方网站", "color": "primary", "action": { "type": "url", "url": "https://pisamusic.partialy.cn", "openMode": "browser" } },
                { "type": "image", "fileId": "img_001", "alt": "Logo", "url": "https://example.com/logo.png" },
                { "type": "highlight", "text": "加入房间", "color": "#00ff00", "action": { "type": "protocol", "value": "pisamusic://scan?type=listen-together-join&roomId=123456" } },
                { "type": "highlight", "text": "复制群号", "color": "info", "action": { "type": "copy", "value": "987654321" } }
              ]
            }
        """.trimIndent()

        val content = gson.fromJson(json, AnnouncementContent::class.java)
        assertEquals(1, content.schemaVersion)
        assertEquals(5, content.blocks.size)

        val block0 = content.blocks[0] as AnnouncementBlock.Text
        assertEquals("欢迎使用 PisaMusic！", block0.text)
        assertTrue(block0.bold)

        val block1 = content.blocks[1] as AnnouncementBlock.Highlight
        assertEquals("官方网站", block1.text)
        assertEquals("primary", block1.color)
        assertTrue(block1.action is AnnouncementAction.Url)
        assertEquals("https://pisamusic.partialy.cn", (block1.action as AnnouncementAction.Url).url)

        val block2 = content.blocks[2] as AnnouncementBlock.Image
        assertEquals("img_001", block2.fileId)
        assertEquals("Logo", block2.alt)
        assertEquals("https://example.com/logo.png", block2.url)

        val block3 = content.blocks[3] as AnnouncementBlock.Highlight
        assertTrue(block3.action is AnnouncementAction.Protocol)
        assertEquals("pisamusic://scan?type=listen-together-join&roomId=123456", (block3.action as AnnouncementAction.Protocol).value)

        val block4 = content.blocks[4] as AnnouncementBlock.Highlight
        assertTrue(block4.action is AnnouncementAction.Copy)
        assertEquals("987654321", (block4.action as AnnouncementAction.Copy).value)
    }

    @Test
    fun `deserialize invalid or incompatible schema fallback to default text`() {
        val invalidSchemaJson = """
            {
              "schemaVersion": 2,
              "blocks": [{ "type": "text", "text": "未来版本" }]
            }
        """.trimIndent()
        val content = gson.fromJson(invalidSchemaJson, AnnouncementContent::class.java)
        assertEquals(1, content.schemaVersion)
        assertEquals(1, content.blocks.size)
        assertEquals("暂无公告", (content.blocks[0] as AnnouncementBlock.Text).text)
    }

    @Test
    fun `shouldUnderline only for Url and Protocol actions`() {
        // 规则 2：高亮的文本，只有 url 和内置地址才显示下划线，其他操作不要下划线
        assertTrue(shouldUnderlineAnnouncementAction(AnnouncementAction.Url(url = "https://example.com")))
        assertTrue(shouldUnderlineAnnouncementAction(AnnouncementAction.Protocol(value = "pisamusic://scan?type=listen-together-join&roomId=123")))
        assertFalse(shouldUnderlineAnnouncementAction(AnnouncementAction.Copy(value = "test")))
        assertFalse(shouldUnderlineAnnouncementAction(AnnouncementAction.None))
    }

    @Test
    fun `announcementPreview replaces images with image placeholder and concatenates text`() {
        val content = AnnouncementContent(
            schemaVersion = 1,
            blocks = listOf(
                AnnouncementBlock.Text("版本更新公告：\n"),
                AnnouncementBlock.Image(fileId = "f1", alt = "封面", url = "https://example.com/a.jpg"),
                AnnouncementBlock.Highlight(color = "primary", text = " 点击此处 "),
                AnnouncementBlock.Text("了解更多详情"),
            ),
        )

        val preview = announcementPreview(content)
        assertEquals("版本更新公告：\n【图片】 点击此处 了解更多详情", preview)
    }

    @Test
    fun `url and protocol validation logic`() {
        assertTrue(isAllowedAnnouncementUrl("https://pisamusic.partialy.cn"))
        assertTrue(isAllowedAnnouncementUrl("https://example.com/path?query=1#hash"))
        assertFalse(isAllowedAnnouncementUrl("http://insecure.com"))
        assertFalse(isAllowedAnnouncementUrl("javascript:alert(1)"))
        assertFalse(isAllowedAnnouncementUrl("ftp://file.com"))

        assertTrue(isAllowedAnnouncementProtocol("pisamusic://scan?type=listen-together-join&roomId=123456"))
        assertTrue(isAllowedAnnouncementProtocol("pisamusic://scan?type=music-share&uuid=abc-123"))
        assertFalse(isAllowedAnnouncementProtocol("custom://scan"))
        assertFalse(isAllowedAnnouncementProtocol("https://pisamusic.partialy.cn"))
    }

    @Test
    fun `color resolution handles presets and hex values`() {
        val defaultColor = 0xFF000000.toInt()
        val primaryResolved = resolveAnnouncementColor("primary", defaultColor)
        val neutralResolved = resolveAnnouncementColor("neutral", defaultColor)
        val hexResolved = resolveAnnouncementColor("#123456", defaultColor)
        val fallback = resolveAnnouncementColor("invalid_color_name", defaultColor)

        assertEquals(0xFF4F46E5.toInt(), primaryResolved)
        assertEquals(0xFF475569.toInt(), neutralResolved)
        assertEquals(0xFF123456.toInt(), hexResolved)
        assertEquals(defaultColor, fallback)
    }
}
