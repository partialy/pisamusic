package cn.partialy.pm.network.api

import cn.partialy.pm.model.BootstrapConfigResponse
import cn.partialy.pm.model.CheckUpdateResponse
import cn.partialy.pm.model.DiscoverResponse
import cn.partialy.pm.model.AgreementResponse
import cn.partialy.pm.model.AboutResponse
import cn.partialy.pm.model.AnnouncementResponse
import cn.partialy.pm.model.DeviceReportRequest
import cn.partialy.pm.model.DeviceReportResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

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

    @GET("api/config/announcements")
    suspend fun getAnnouncements(): AnnouncementResponse

    @POST("api/device/report")
    suspend fun reportDevice(@Body body: DeviceReportRequest): DeviceReportResponse
}
