package cn.partialy.pm.network.api

import cn.partialy.pm.model.BootstrapConfigResponse
import cn.partialy.pm.model.CheckUpdateResponse
import cn.partialy.pm.model.DiscoverResponse
import cn.partialy.pm.model.DynamicConfigResponse
import cn.partialy.pm.model.AgreementResponse
import cn.partialy.pm.model.AboutResponse
import cn.partialy.pm.model.AnnouncementResponse
import cn.partialy.pm.model.AccountAuthResponse
import cn.partialy.pm.model.AccountCodeLoginRequest
import cn.partialy.pm.model.AccountEmailCodeRequest
import cn.partialy.pm.model.AccountEmailCodeResponse
import cn.partialy.pm.model.AccountMeResponse
import cn.partialy.pm.model.AccountPasswordLoginRequest
import cn.partialy.pm.model.AccountPasswordResetRequest
import cn.partialy.pm.model.AccountPasswordResetResponse
import cn.partialy.pm.model.AccountProfileEmailCodeRequest
import cn.partialy.pm.model.AccountProfileUpdateRequest
import cn.partialy.pm.model.AccountRegisterRequest
import cn.partialy.pm.model.DeviceReportRequest
import cn.partialy.pm.model.DeviceReportResponse
import cn.partialy.pm.model.SyncChangesResponse
import cn.partialy.pm.model.SyncPushRequest
import cn.partialy.pm.model.SyncPushResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Query

interface SystemApiService {
    @GET("api/config/bootstrap")
    suspend fun getBootstrapConfig(): BootstrapConfigResponse

    @GET("api/config/check-update")
    suspend fun getCheckUpdate(): CheckUpdateResponse

    @GET("api/config/discover")
    suspend fun getDiscover(): DiscoverResponse

    @GET("api/config/agreement")
    suspend fun getAgreement(): AgreementResponse

    @GET("api/config/service-agreement")
    suspend fun getServiceAgreement(): AgreementResponse

    @GET("api/config/privacy-policy")
    suspend fun getPrivacyPolicy(): AgreementResponse

    @GET("api/config/about")
    suspend fun getAbout(): AboutResponse

    @GET("api/config/get")
    suspend fun getDynamicConfig(@Query("id") id: String): DynamicConfigResponse

    @GET("api/config/announcements")
    suspend fun getAnnouncements(): AnnouncementResponse

    @POST("api/device/report")
    suspend fun reportDevice(@Body body: DeviceReportRequest): DeviceReportResponse

    @POST("api/auth/email-code")
    suspend fun sendAccountEmailCode(@Body body: AccountEmailCodeRequest): AccountEmailCodeResponse

    @POST("api/auth/register")
    suspend fun registerAccount(@Body body: AccountRegisterRequest): AccountAuthResponse

    @POST("api/auth/login/password")
    suspend fun loginAccountByPassword(@Body body: AccountPasswordLoginRequest): AccountAuthResponse

    @POST("api/auth/login/code")
    suspend fun loginAccountByCode(@Body body: AccountCodeLoginRequest): AccountAuthResponse

    @POST("api/auth/password/reset")
    suspend fun resetAccountPassword(@Body body: AccountPasswordResetRequest): AccountPasswordResetResponse

    @POST("api/auth/refresh")
    suspend fun refreshAccountToken(@Header("Authorization") authorization: String): AccountAuthResponse

    @GET("api/auth/me")
    suspend fun getAccountMe(@Header("Authorization") authorization: String): AccountMeResponse

    @POST("api/auth/profile/email-code")
    suspend fun sendAccountProfileEmailCode(
        @Header("Authorization") authorization: String,
        @Body body: AccountProfileEmailCodeRequest,
    ): AccountEmailCodeResponse

    @PATCH("api/auth/profile")
    suspend fun updateAccountProfile(
        @Header("Authorization") authorization: String,
        @Body body: AccountProfileUpdateRequest,
    ): AccountAuthResponse

    @GET("api/sync/changes")
    suspend fun getSyncChanges(
        @Header("Authorization") authorization: String,
        @Header("x-pm-device-id") deviceId: String,
        @Query("since") since: Long,
    ): SyncChangesResponse

    @POST("api/sync/changes")
    suspend fun pushSyncChanges(
        @Header("Authorization") authorization: String,
        @Header("x-pm-device-id") deviceId: String,
        @Body body: SyncPushRequest,
    ): SyncPushResponse
}
