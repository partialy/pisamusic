package cn.partialy.pm.announcement

import com.google.gson.annotations.JsonAdapter
import cn.partialy.pm.model.AnnouncementItem

@JsonAdapter(AnnouncementContentAdapter::class)
data class AnnouncementContent(
    val schemaVersion: Int = 1,
    val blocks: List<AnnouncementBlock> = emptyList(),
)

sealed interface AnnouncementBlock {
    data class Text(
        val text: String,
        val bold: Boolean = false,
    ) : AnnouncementBlock

    data class Image(
        val fileId: String,
        val alt: String = "公告图片",
        val url: String? = null,
    ) : AnnouncementBlock

    data class Highlight(
        val color: String,
        val text: String,
        val action: AnnouncementAction = AnnouncementAction.None,
    ) : AnnouncementBlock
}

sealed interface AnnouncementAction {
    object None : AnnouncementAction

    data class Copy(
        val label: String = "复制",
        val value: String,
    ) : AnnouncementAction

    data class Url(
        val label: String = "打开",
        val url: String,
        val openMode: OpenMode = OpenMode.BROWSER,
    ) : AnnouncementAction {
        enum class OpenMode {
            BROWSER,
            APP;

            companion object {
                fun fromString(value: String?): OpenMode {
                    return if (value.equals("app", ignoreCase = true)) APP else BROWSER
                }
            }
        }
    }

    data class Protocol(
        val label: String = "打开",
        val value: String,
    ) : AnnouncementAction
}

data class AnnouncementFeedState(
    val loading: Boolean = false,
    val error: String? = null,
    val announcements: List<AnnouncementItem> = emptyList(),
)
