package cn.partialy.pm.network.repository

import cn.partialy.pm.model.BootstrapConfigResponse
import cn.partialy.pm.model.AnnouncementResponse
import cn.partialy.pm.model.DiscoverResponse
import cn.partialy.pm.network.api.SystemApiService
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SystemRepository @Inject constructor(
    private val api: SystemApiService
) {
    suspend fun getBootstrapConfig(): Result<BootstrapConfigResponse> {
        return try {
            Result.success(api.getBootstrapConfig())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getAnnouncements(): Result<AnnouncementResponse> {
        return try {
            Result.success(api.getAnnouncements())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDiscover(): Result<DiscoverResponse> {
        return try {
            Result.success(api.getDiscover())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
