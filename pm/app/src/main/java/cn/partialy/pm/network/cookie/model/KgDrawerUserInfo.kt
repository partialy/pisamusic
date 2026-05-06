package cn.partialy.pm.network.cookie.model

/** 侧栏展示的酷狗账号摘要（来自 /login/token + 可选 /user/playlist 回退）。 */
data class KgDrawerUserInfo(
    val nickname: String,
    val avatarUrl: String?,
)
