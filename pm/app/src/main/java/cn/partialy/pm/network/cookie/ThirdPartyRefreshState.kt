package cn.partialy.pm.network.cookie

data class ThirdPartyRefreshState(
    val autoRefresh: Boolean = false,
    val lastAttemptAt: Long = 0L,
    val lastSucceeded: Boolean? = null,
    val refreshing: Boolean = false,
)

sealed interface ThirdPartyRefreshResult {
    data object SUCCESS : ThirdPartyRefreshResult
    data class Failed(val sources: List<String>) : ThirdPartyRefreshResult
    data object SKIPPED : ThirdPartyRefreshResult
}
