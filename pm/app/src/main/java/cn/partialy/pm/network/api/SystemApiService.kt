package cn.partialy.pm.network.api

import cn.partialy.pm.model.BootstrapConfigResponse
import cn.partialy.pm.model.CheckUpdateResponse
import cn.partialy.pm.model.DiscoverResponse
import cn.partialy.pm.model.DynamicConfigResponse
import cn.partialy.pm.model.AgreementResponse
import cn.partialy.pm.model.AboutResponse
import cn.partialy.pm.model.AnnouncementResponse
import cn.partialy.pm.model.AccountAuthResponse
import cn.partialy.pm.model.AccountAvatarUploadTokenRequest
import cn.partialy.pm.model.AccountAvatarUploadTokenResponse
import cn.partialy.pm.model.AccountCodeLoginRequest
import cn.partialy.pm.model.AccountEmailCodeRequest
import cn.partialy.pm.model.AccountEmailCodeResponse
import cn.partialy.pm.model.AccountPhoneCodeRequest
import cn.partialy.pm.model.AccountMeResponse
import cn.partialy.pm.model.AccountPasswordLoginRequest
import cn.partialy.pm.model.AccountPasswordResetRequest
import cn.partialy.pm.model.AccountPasswordResetResponse
import cn.partialy.pm.model.AccountProfileEmailCodeRequest
import cn.partialy.pm.model.AccountProfilePhoneCodeRequest
import cn.partialy.pm.model.AccountProfileUpdateRequest
import cn.partialy.pm.model.AccountRegisterRequest
import cn.partialy.pm.model.DeviceReportRequest
import cn.partialy.pm.model.DeviceReportResponse
import cn.partialy.pm.directmessage.DirectMessageReadResponse
import cn.partialy.pm.directmessage.DirectMessageUnreadResponse
import cn.partialy.pm.model.SyncChangesResponse
import cn.partialy.pm.model.SyncPushRequest
import cn.partialy.pm.model.SyncPushResponse
import cn.partialy.pm.listen.ListenTogetherCreateRoomRequest
import cn.partialy.pm.listen.ListenTogetherRoomResponse
import cn.partialy.pm.share.ShareCreateRequest
import cn.partialy.pm.share.ShareCreateResponse
import cn.partialy.pm.share.SharePublicResponse
import cn.partialy.pm.fault.FaultReportRequest
import cn.partialy.pm.fault.FaultReportSubmitResponse
import cn.partialy.pm.network.cloudmusic.CloudMusicEnvelope
import cn.partialy.pm.network.cloudmusic.CloudMusicSearchDto
import cn.partialy.pm.network.cloudmusic.CloudMusicSignedResourceDto
import cn.partialy.pm.network.cloudmusic.CloudMusicAssetReserveRequest
import cn.partialy.pm.network.cloudmusic.CloudMusicAssetUploadTicketDto
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionHistoryDto
import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionInput
import cn.partialy.pm.network.cloudmusic.CloudMusicSummaryDto
import cn.partialy.pm.network.cloudmusic.CloudMusicTrackDto
import cn.partialy.pm.network.cloudmusic.CloudMusicUploadSessionDto
import cn.partialy.pm.network.cloudmusic.CloudMusicUploadSessionRequest
import cn.partialy.pm.listening.ListeningBatchRequest
import cn.partialy.pm.listening.ListeningBatchResponse
import cn.partialy.pm.listening.ListeningSummaryResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.Path
import retrofit2.http.POST
import retrofit2.http.Query
import retrofit2.http.Url

interface SystemApiService {
    @GET
    suspend fun getBootstrapConfig(@Url path: String): BootstrapConfigResponse

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

    @GET("api/messages/unread")
    suspend fun getUnreadDirectMessages(
        @Header("Authorization") authorization: String?,
        @Header("x-pm-device-token") deviceToken: String?,
        @Query("limit") limit: Int = 50,
    ): DirectMessageUnreadResponse

    @POST("api/messages/{id}/read")
    suspend fun markDirectMessageRead(
        @Path("id") id: String,
        @Header("Authorization") authorization: String?,
        @Header("x-pm-device-token") deviceToken: String?,
        @Body body: Map<String, String> = emptyMap(),
    ): DirectMessageReadResponse

    @POST("api/fault-reports")
    suspend fun submitFaultReport(
        @Header("Authorization") authorization: String?,
        @Body body: FaultReportRequest,
    ): FaultReportSubmitResponse

    @POST("api/auth/email-code")
    suspend fun sendAccountEmailCode(@Body body: AccountEmailCodeRequest): AccountEmailCodeResponse

    @POST("api/auth/phone-code")
    suspend fun sendAccountPhoneCode(@Body body: AccountPhoneCodeRequest): AccountEmailCodeResponse

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

    @POST("api/auth/avatar/upload-token")
    suspend fun getAccountAvatarUploadToken(
        @Header("Authorization") authorization: String,
        @Body body: AccountAvatarUploadTokenRequest,
    ): AccountAvatarUploadTokenResponse

    @POST("api/auth/profile/email-code")
    suspend fun sendAccountProfileEmailCode(
        @Header("Authorization") authorization: String,
        @Body body: AccountProfileEmailCodeRequest,
    ): AccountEmailCodeResponse

    @POST("api/auth/profile/phone-code")
    suspend fun sendAccountProfilePhoneCode(
        @Header("Authorization") authorization: String,
        @Body body: AccountProfilePhoneCodeRequest,
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

    @POST("api/listening/fragments/batch")
    suspend fun uploadListeningFragments(
        @Header("Authorization") authorization: String,
        @Header("x-pm-device-id") deviceId: String,
        @Body body: ListeningBatchRequest,
    ): ListeningBatchResponse

    @GET("api/listening/summary")
    suspend fun getListeningSummary(
        @Header("Authorization") authorization: String,
    ): ListeningSummaryResponse

    @POST("api/listen-together/rooms")
    suspend fun createListenTogetherRoom(
        @Header("Authorization") authorization: String,
        @Body body: ListenTogetherCreateRoomRequest,
    ): ListenTogetherRoomResponse

    @GET("api/listen-together/rooms/{roomId}")
    suspend fun getListenTogetherRoom(
        @Header("Authorization") authorization: String,
        @Path("roomId") roomId: String,
    ): ListenTogetherRoomResponse

    @POST("api/shares")
    suspend fun createShare(
        @Header("Authorization") authorization: String,
        @Body body: ShareCreateRequest,
    ): ShareCreateResponse

    @GET("api/shares/public/{uuid}")
    suspend fun getPublicShare(
        @Path("uuid") uuid: String,
    ): SharePublicResponse

    @GET("api/cloud-music/summary")
    suspend fun getCloudMusicSummary(
        @Header("Authorization") authorization: String? = null,
    ): CloudMusicEnvelope<CloudMusicSummaryDto>

    @GET("api/cloud-music/search")
    suspend fun searchCloudMusic(
        @Query("keyword") keyword: String,
        @Query("offset") offset: Int,
        @Query("limit") limit: Int,
    ): CloudMusicEnvelope<CloudMusicSearchDto>

    @GET("api/cloud-music/tracks/{uuid}")
    suspend fun getCloudMusicTrack(
        @Path("uuid") uuid: String,
    ): CloudMusicEnvelope<CloudMusicTrackDto>

    @GET("api/cloud-music/tracks/{uuid}/play-url")
    suspend fun getCloudMusicPlayUrl(
        @Path("uuid") uuid: String,
    ): CloudMusicEnvelope<CloudMusicSignedResourceDto>

    @GET("api/cloud-music/tracks/{uuid}/lyrics-url")
    suspend fun getCloudMusicLyricsUrl(
        @Path("uuid") uuid: String,
    ): CloudMusicEnvelope<CloudMusicSignedResourceDto>

    @POST("api/cloud-music/submit/upload-sessions")
    suspend fun createCloudMusicUploadSession(
        @Header("Authorization") authorization: String,
        @Body body: CloudMusicUploadSessionRequest,
    ): CloudMusicEnvelope<CloudMusicUploadSessionDto>

    @POST("api/cloud-music/submit/{uuid}/assets/{kind}/reserve")
    suspend fun reserveCloudMusicAsset(
        @Header("Authorization") authorization: String,
        @Path("uuid") uuid: String,
        @Path("kind") kind: String,
        @Body body: CloudMusicAssetReserveRequest,
    ): CloudMusicEnvelope<CloudMusicAssetUploadTicketDto>

    @POST("api/cloud-music/submit/{uuid}/assets/{kind}/complete")
    suspend fun completeCloudMusicAsset(
        @Header("Authorization") authorization: String,
        @Path("uuid") uuid: String,
        @Path("kind") kind: String,
    ): CloudMusicEnvelope<CloudMusicTrackDto>

    @DELETE("api/cloud-music/submit/{uuid}/cover")
    suspend fun removeCloudMusicCover(
        @Header("Authorization") authorization: String,
        @Path("uuid") uuid: String,
    ): CloudMusicEnvelope<CloudMusicTrackDto>

    @POST("api/cloud-music/submit/{uuid}/save")
    suspend fun saveCloudMusicSubmission(
        @Header("Authorization") authorization: String,
        @Path("uuid") uuid: String,
        @Body body: CloudMusicSubmissionInput,
    ): CloudMusicEnvelope<CloudMusicTrackDto>

    @GET("api/cloud-music/submit/my-history")
    suspend fun getCloudMusicSubmissionHistory(
        @Header("Authorization") authorization: String,
        @Query("offset") offset: Int,
        @Query("limit") limit: Int,
    ): CloudMusicEnvelope<CloudMusicSubmissionHistoryDto>

    @POST("api/cloud-music/submit/{uuid}/resubmit")
    suspend fun resubmitCloudMusicSubmission(
        @Header("Authorization") authorization: String,
        @Path("uuid") uuid: String,
        @Body body: CloudMusicSubmissionInput,
    ): CloudMusicEnvelope<CloudMusicTrackDto>
}
