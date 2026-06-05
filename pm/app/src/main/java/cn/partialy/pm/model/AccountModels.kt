package cn.partialy.pm.model

data class AccountEmailCodeRequest(
    val email: String,
    val purpose: String,
)

data class AccountProfileEmailCodeRequest(
    val email: String,
)

data class AccountAvatarUploadTokenRequest(
    val fileName: String,
    val fileSize: Long,
    val mimeType: String? = null,
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

data class AccountPasswordResetRequest(
    val email: String,
    val code: String,
    val newPassword: String,
)

data class AccountPasswordResetResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: AccountPasswordResetResult,
)

data class AccountPasswordResetResult(
    val updated: Boolean,
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

data class AccountAvatarUploadTokenResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: AccountAvatarUploadToken,
)

data class AccountEmailCodeResult(
    val expiresAt: Long,
    val nextSendAt: Long,
)

data class AccountAvatarUploadToken(
    val provider: String,
    val uploadToken: String,
    val uploadUrl: String,
    val key: String,
    val bucket: String,
    val domain: String = "",
    val cdnDomain: String = "",
    val downloadUrl: String = "",
    val expiresAt: Long,
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
    val lastLoginAt: Long? = null,
)
