package cn.partialy.pm.network.cloudmusic

import android.net.Uri

enum class CloudMusicSubmissionFileKind {
    AUDIO,
    COVER,
    LYRICS,
}

/** 仅描述当前页面选中的 Content URI，不复制或持久化文件内容。 */
data class CloudMusicSubmissionFile(
    val uri: Uri,
    val displayName: String,
    val size: Long,
    val mimeType: String,
    val kind: CloudMusicSubmissionFileKind,
)
