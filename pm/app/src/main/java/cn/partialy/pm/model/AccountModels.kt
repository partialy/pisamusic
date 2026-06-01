package cn.partialy.pm.model

data class AccountEmailCodeRequest(
    val email: String,
    val purpose: String,
)

data class AccountProfileEmailCodeRequest(
    val email: String,
)

data class AccountRegisterRequest(
    val email: String,
    val username: String,
    val password: String,
    val code: String,
)

data class AccountPasswordLoginRequest(
    val identifier: String,
    val password: String,
)

data class AccountCodeLoginRequest(
    val email: String,
    val code: String,
)

data class AccountProfileUpdateRequest(
    val username: String? = null,
    val email: String? = null,
    val code: String? = null,
    val avatarKey: String? = null,
)

data class AccountAuthResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: AccountAuthResult,
)

data class AccountMeResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: AccountUser,
)

data class AccountEmailCodeResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: AccountEmailCodeResult,
)

data class AccountEmailCodeResult(
    val expiresAt: Long,
    val nextSendAt: Long,
)

data class AccountAuthResult(
    val token: String,
    val expiresAt: Long,
    val user: AccountUser,
)

data class AccountUser(
    val id: String,
    val username: String,
    val email: String,
    val avatar: String = "",
    val avatarKey: String = "default",
    val avatarUrl: String = "",
    val createdAt: Long = 0L,
)
