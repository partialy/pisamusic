package cn.partialy.pm.utils

object AppVersionComparator {
    /**
     * 比较远程版本是否严格高于本地版本（即有新版本可用）。
     * 版本结构例如 "2.6.0"、"v2.6.0"、"2.6.0.1" 等。
     * 当 local >= server 时返回 false（如 2.6.0 >= 2.5.x 不提示）；仅当 server > local 时返回 true。
     */
    fun isServerVersionNewer(localVersion: String?, serverVersion: String?): Boolean {
        if (localVersion.isNullOrBlank() || serverVersion.isNullOrBlank()) return false
        val localParts = parseVersionParts(localVersion)
        val serverParts = parseVersionParts(serverVersion)
        if (localParts.isEmpty() || serverParts.isEmpty()) return false

        val maxLen = maxOf(localParts.size, serverParts.size)
        for (i in 0 until maxLen) {
            val localNum = localParts.getOrElse(i) { 0 }
            val serverNum = serverParts.getOrElse(i) { 0 }
            if (serverNum > localNum) return true
            if (serverNum < localNum) return false
        }
        return false
    }

    private fun parseVersionParts(version: String): List<Int> {
        val clean = version.trim()
            .removePrefix("v")
            .removePrefix("V")
            .trim()
        if (clean.isEmpty()) return emptyList()

        return clean.split('.')
            .mapNotNull { segment ->
                val digits = segment.trim().takeWhile { it.isDigit() }
                digits.toIntOrNull()
            }
    }
}
