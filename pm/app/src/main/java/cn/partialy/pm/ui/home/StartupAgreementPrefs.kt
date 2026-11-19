package cn.partialy.pm.ui.home

import android.content.Context

/**
 * 启动用户协议同意状态持久化（沿用原 `splash_prefs` 存储名与键名，保持老用户升级无缝兼容）。
 */
object StartupAgreementPrefs {
    private const val SPLASH_PREFS = "splash_prefs"
    private const val KEY_AGREEMENT_ACCEPTED = "agreement_accepted"
    private const val KEY_AGREEMENT_VERSION = "agreement_version"
    const val DEFAULT_AGREEMENT_VERSION = 1L

    fun isAgreementAccepted(context: Context, version: Long? = null): Boolean {
        val sp = context.getSharedPreferences(SPLASH_PREFS, Context.MODE_PRIVATE)
        if (!sp.getBoolean(KEY_AGREEMENT_ACCEPTED, false)) return false
        return version == null || sp.getLong(KEY_AGREEMENT_VERSION, Long.MIN_VALUE) == version
    }

    fun setAgreementAccepted(
        context: Context,
        accepted: Boolean,
        version: Long = DEFAULT_AGREEMENT_VERSION,
    ) {
        val sp = context.getSharedPreferences(SPLASH_PREFS, Context.MODE_PRIVATE)
        sp.edit().apply {
            putBoolean(KEY_AGREEMENT_ACCEPTED, accepted)
            if (accepted) {
                putLong(KEY_AGREEMENT_VERSION, version)
            } else {
                remove(KEY_AGREEMENT_VERSION)
            }
        }.apply()
    }
}
