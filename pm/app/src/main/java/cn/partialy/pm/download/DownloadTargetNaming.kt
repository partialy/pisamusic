package cn.partialy.pm.download

import java.io.File

/** 音频、歌词和临时文件共用 basename 命名域。 */
internal fun downloadTargetBasename(fileName: String): String =
    File(fileName.removeSuffix(".part")).nameWithoutExtension.lowercase()
