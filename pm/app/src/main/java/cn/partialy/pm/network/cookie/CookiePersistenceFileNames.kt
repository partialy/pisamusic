package cn.partialy.pm.network.cookie

/**
 * [PersistedUserCookieStore] 在 [android.content.Context.getFilesDir] 下的文件名（KG / WY 各一份）。
 */
object CookiePersistenceFileNames {
    const val KUGOU: String = "kugou_cookie_user.json"
    const val WY: String = "wy_cookie_user.json"

    val ALL: List<String> = listOf(KUGOU, WY)
}
