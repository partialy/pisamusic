package cn.partialy.pm.model

import cn.partialy.pm.R

/** PisaMusic 系统账号的音质访问状态，不包含任何第三方音乐账号信息。 */
data class MusicQualityAccessState(
    val loggedIn: Boolean,
    val vipActive: Boolean,
)

/**
 * 下载默认音质配置的解析结果。
 */
sealed interface DownloadQualityResolution {
    /** 未设置或设为“每次询问”，下载前弹窗选择音质。 */
    object AskEveryTime : DownloadQualityResolution

    /** 已设固定音质且当前系统账号有权使用，可直接跳过弹窗入队。 */
    data class Allowed(val choice: DownloadQualityChoice) : DownloadQualityResolution

    /** 已设固定音质但当前系统账号无权使用（如退出登录或 VIP 到期）。 */
    data class Restricted(val choice: DownloadQualityChoice) : DownloadQualityResolution
}

/**
 * KG/WY/KW 共用的音质可见性、可用性与已保存音质回退规则。
 *
 * 该策略只依赖业务模型；调用方负责把当前系统账号 Session 转换为 [MusicQualityAccessState]。
 */
object MusicQualityAccessPolicy {
    const val DOWNLOAD_QUALITY_ASK = "ask"

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
        if (type == SongType.KW || type == SongType.CLOUD || type == SongType.LOCAL || hasVipAccess(access)) {
            return original
        }

        val regularChoices = when (type) {
            SongType.KG -> regularKgChoices
            SongType.WY -> regularWyChoices
            SongType.KW, SongType.CLOUD, SongType.LOCAL -> emptySet()
        }
        val guestEnabledChoices = when (type) {
            SongType.KG -> guestEnabledKgChoices
            SongType.WY -> guestEnabledWyChoices
            SongType.KW, SongType.CLOUD, SongType.LOCAL -> emptySet()
        }
        val enabledChoices = if (access.loggedIn) regularChoices else guestEnabledChoices
        val restrictedBadgeRes = if (access.loggedIn) {
            R.string.quality_badge_unlock_required
        } else {
            R.string.quality_badge_login_required
        }
        val evaluated = original.map { option ->
            if (option.choice in enabledChoices) {
                option
            } else {
                option.copy(enabled = false, badgeRes = restrictedBadgeRes)
            }
        }
        val (enabledOptions, disabledOptions) = evaluated.partition { it.enabled }
        return enabledOptions + disabledOptions
    }

    fun isChoiceAllowed(
        type: SongType,
        choice: DownloadQualityChoice,
        access: MusicQualityAccessState,
    ): Boolean = choice.matchesSongType(type) &&
        optionsFor(type, access).any { option -> option.choice == choice && option.enabled }

    /**
     * 各音源默认播放音质：KG / WY 对所有账号统一默认第一档（KG 128 kbps、WY [码率] 128 kbps），
     * CLOUD 为默认档，KW 维持空值沿用自动选档。
     */
    fun defaultChoice(type: SongType): DownloadQualityChoice? = when (type) {
        SongType.KG -> DownloadQualityChoice.Kugou("128")
        SongType.WY -> DownloadQualityChoice.NeteaseBr(128_000)
        SongType.CLOUD -> DownloadQualityChoice.CloudDefault
        SongType.KW, SongType.LOCAL -> null
    }

    /**
     * 校验已保存的播放音质。KG/WY 未配置时对所有账号（含 VIP）统一默认返回第一档；
     * 保存值越权或音源不匹配时同样回退到安全第一档。KW 未配置时仍沿用自动选档策略。
     */
    fun allowedChoiceOrFallback(
        type: SongType,
        choice: DownloadQualityChoice?,
        access: MusicQualityAccessState,
    ): DownloadQualityChoice? {
        if (choice == null) return defaultChoice(type)
        if (isChoiceAllowed(type, choice, access)) return choice
        return fallbackChoice(type)
    }

    /**
     * 解析指定音源的“默认下载音质”配置在当前账号权限下的有效状态。
     */
    fun resolveDownloadDefaultChoice(
        type: SongType,
        savedKey: String?,
        access: MusicQualityAccessState,
    ): DownloadQualityResolution {
        if (savedKey.isNullOrBlank() || savedKey == DOWNLOAD_QUALITY_ASK) {
            return DownloadQualityResolution.AskEveryTime
        }
        val parsed = playbackQualityChoiceFromKey(savedKey)
            ?.takeIf { it.matchesSongType(type) }
            ?: return DownloadQualityResolution.AskEveryTime
        return if (isChoiceAllowed(type, parsed, access)) {
            DownloadQualityResolution.Allowed(parsed)
        } else {
            DownloadQualityResolution.Restricted(parsed)
        }
    }

    private fun hasVipAccess(access: MusicQualityAccessState): Boolean =
        access.loggedIn && access.vipActive

    private fun fallbackChoice(type: SongType): DownloadQualityChoice? = when (type) {
        SongType.KG -> DownloadQualityChoice.Kugou("128")
        SongType.WY -> DownloadQualityChoice.NeteaseBr(128_000)
        SongType.KW -> DownloadQualityChoice.Kuwo("standard")
        SongType.CLOUD -> DownloadQualityChoice.CloudDefault
        SongType.LOCAL -> null
    }
}
