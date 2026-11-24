package cn.partialy.pm.network.cookie

enum class ThirdPartyLoginValidity { UNCHECKED, VALID, EXPIRED }

data class ThirdPartyAccountState(
    val source: String,
    val profile: MusicLoginProfile?,
    val loggedIn: Boolean,
    val validity: ThirdPartyLoginValidity,
    val checking: Boolean = false,
    val sessionKey: String = "",
)

/** 仅供网络层捕获会话，禁止记录 Cookie 或将此对象传给 UI。 */
data class MusicSessionSnapshot internal constructor(
    val source: String,
    val cookie: String,
    val profile: MusicLoginProfile?,
    internal val revision: Long,
    internal val fingerprint: String,
) {
    val sessionKey: String get() = "$revision:$fingerprint"
    override fun toString(): String = "MusicSessionSnapshot(source=$source, revision=$revision)"
}
