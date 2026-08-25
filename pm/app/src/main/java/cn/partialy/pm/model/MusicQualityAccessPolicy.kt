package cn.partialy.pm.model

/** PisaMusic 系统账号的音质访问状态，不包含任何第三方音乐账号信息。 */
data class MusicQualityAccessState(
    val loggedIn: Boolean,
    val vipActive: Boolean,
)

/**
 * KG/WY/KW 共用的音质可见性、可用性与已保存音质回退规则。
 *
 * 该策略只依赖业务模型；调用方负责把当前系统账号 Session 转换为 [MusicQualityAccessState]。
 */
object MusicQualityAccessPolicy {
    private const val LOGIN_REQUIRED_BADGE = "需登录"

    private val guestEnabledKgChoices = setOf(
        DownloadQualityChoice.Kugou("128"),
    )
    private val regularKgChoices = guestEnabledKgChoices + setOf(
        DownloadQualityChoice.Kugou("320"),
        DownloadQualityChoice.Kugou("high"),
    )

    private val guestEnabledWyChoices = setOf(
        DownloadQualityChoice.NeteaseBr(128_000),
        DownloadQualityChoice.NeteaseLevel("standard"),
    )
    private val regularWyChoices = guestEnabledWyChoices + setOf(
        DownloadQualityChoice.NeteaseLevel("higher"),
        DownloadQualityChoice.NeteaseLevel("exhigh"),
    )

    fun optionsFor(
        type: SongType,
        access: MusicQualityAccessState,
    ): List<DownloadQualityOption> {
        val original = downloadOptionsForSongType(type)
        if (type == SongType.KW || type == SongType.LOCAL || hasVipAccess(access)) {
            return original
        }

        val regularChoices = when (type) {
            SongType.KG -> regularKgChoices
            SongType.WY -> regularWyChoices
            SongType.KW, SongType.LOCAL -> emptySet()
        }
        val visible = original.filter { it.choice in regularChoices }
        if (access.loggedIn) return visible

        val guestEnabledChoices = when (type) {
            SongType.KG -> guestEnabledKgChoices
            SongType.WY -> guestEnabledWyChoices
            SongType.KW, SongType.LOCAL -> emptySet()
        }
        return visible.map { option ->
            if (option.choice in guestEnabledChoices) {
                option
            } else {
                option.copy(enabled = false, badge = LOGIN_REQUIRED_BADGE)
            }
        }
    }

    fun isChoiceAllowed(
        type: SongType,
        choice: DownloadQualityChoice,
        access: MusicQualityAccessState,
    ): Boolean = choice.matchesSongType(type) &&
        optionsFor(type, access).any { option -> option.choice == choice && option.enabled }

    /**
     * 校验已保存的播放音质。KG/WY 非有效 VIP 即使没有保存值，也必须回退到
     * 安全档位，避免播放器的自动选档链继续尝试高阶音质；有效 VIP、KW 与 LOCAL
     * 没有保存值时继续沿用原有自动策略。保存值越权或音源不匹配时同样安全回退。
     */
    fun allowedChoiceOrFallback(
        type: SongType,
        choice: DownloadQualityChoice?,
        access: MusicQualityAccessState,
    ): DownloadQualityChoice? {
        if (choice == null) {
            val requiresSafeDefault =
                (type == SongType.KG || type == SongType.WY) && !hasVipAccess(access)
            return if (requiresSafeDefault) fallbackChoice(type) else null
        }
        if (isChoiceAllowed(type, choice, access)) return choice
        return fallbackChoice(type)
    }

    private fun hasVipAccess(access: MusicQualityAccessState): Boolean =
        access.loggedIn && access.vipActive

    private fun fallbackChoice(type: SongType): DownloadQualityChoice? = when (type) {
        SongType.KG -> DownloadQualityChoice.Kugou("128")
        SongType.WY -> DownloadQualityChoice.NeteaseLevel("standard")
        SongType.KW -> DownloadQualityChoice.Kuwo("standard")
        SongType.LOCAL -> null
    }
}
