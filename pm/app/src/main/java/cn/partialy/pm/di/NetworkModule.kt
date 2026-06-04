package cn.partialy.pm.di

import cn.partialy.pm.BuildConfig
import cn.partialy.pm.listen.ListenTogetherConfigApiService
import cn.partialy.pm.network.api.KgApiService
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.network.crypto.SystemEncryptionInterceptor
import cn.partialy.pm.network.gateway.GatewaySignInterceptor
import cn.partialy.pm.network.interceptor.AuthInterceptor
import cn.partialy.pm.network.kg.DfidHolder
import cn.partialy.pm.network.kg.DfidInterceptor
import cn.partialy.pm.network.kg.KgUrlProxyApiService
import cn.partialy.pm.network.kw.KwSearchApiService
import cn.partialy.pm.network.kw.KwUrlProxyApiService
import cn.partialy.pm.network.wy.WyApiService
import cn.partialy.pm.network.wy.WyUrlProxyApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Named
import javax.inject.Singleton
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    @Named("system_api_base_url")
    fun provideSystemApiBaseUrl(): String = BuildConfig.SYSTEM_SERVICE_BASE_URL

    @Provides
    @Singleton
    fun provideDfidHolder(): DfidHolder = DfidHolder()

    @Provides
    @Singleton
    fun provideOkHttpClient(
        gatewaySignInterceptor: GatewaySignInterceptor,
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor())
            .addInterceptor(gatewaySignInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    /**
     * 自有后端专用 client。加密拦截器要包在日志拦截器外层：
     * - 请求先由加密拦截器改写成 `{isEnc, encData}`，日志再打印密文。
     * - 响应先由日志打印服务端密文信封，最后再交给加密拦截器解密给 Retrofit。
     *
     * KG/WY/KW 一律不走这条 client。
     */
    @Provides
    @Singleton
    @Named("system_okhttp")
    fun provideSystemOkHttpClient(
        encryptionInterceptor: SystemEncryptionInterceptor,
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(encryptionInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                redactHeader("Authorization")
                level = HttpLoggingInterceptor.Level.BODY
            })
            .addInterceptor(AuthInterceptor())
            .build()
    }

    /** 蓝源取链：附带 dfid（见 apidoc /register/dev） */
    @Provides
    @Singleton
    @Named("kg_proxy")
    fun provideKgProxyOkHttpClient(
        dfidHolder: DfidHolder,
        gatewaySignInterceptor: GatewaySignInterceptor,
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor())
            .addInterceptor(DfidInterceptor(dfidHolder))
            .addInterceptor(gatewaySignInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
    }

    @Provides
    @Singleton
    fun provideSystemApiService(
        @Named("system_okhttp") okHttpClient: OkHttpClient,
        @Named("system_api_base_url") systemApiBaseUrl: String,
    ): SystemApiService {
        return Retrofit.Builder()
            .baseUrl(systemApiBaseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(SystemApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideListenTogetherConfigApiService(
        @Named("system_api_base_url") systemApiBaseUrl: String,
    ): ListenTogetherConfigApiService {
        val plainClient = OkHttpClient.Builder()
            .addInterceptor(HttpLoggingInterceptor().apply {
                redactHeader("Authorization")
                level = HttpLoggingInterceptor.Level.BODY
            })
            .build()
        return Retrofit.Builder()
            .baseUrl(systemApiBaseUrl)
            .client(plainClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ListenTogetherConfigApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideKgApiService(okHttpClient: OkHttpClient, configManager: ConfigManager): KgApiService {
        return Retrofit.Builder()
            .baseUrl(configManager.getKgBaseUrl())
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(KgApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideKgUrlProxyApiService(
        @Named("kg_proxy") okHttpClient: OkHttpClient,
        configManager: ConfigManager,
    ): KgUrlProxyApiService {
        return Retrofit.Builder()
            .baseUrl(configManager.getProxyBaseUrl())
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(KgUrlProxyApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideWyApiService(
        okHttpClient: OkHttpClient,
        configManager: ConfigManager,
    ): WyApiService {
        return Retrofit.Builder()
            .baseUrl(configManager.getWyBaseUrl())
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(WyApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideWyUrlProxyApiService(
        okHttpClient: OkHttpClient,
        configManager: ConfigManager,
    ): WyUrlProxyApiService {
        return Retrofit.Builder()
            .baseUrl(configManager.getProxyBaseUrl())
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(WyUrlProxyApiService::class.java)
    }

    @Provides
    @Singleton
    @Named("kw_proxy")
    fun provideKwProxyRetrofit(
        okHttpClient: OkHttpClient,
        configManager: ConfigManager,
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(configManager.getKwBaseUrl())
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideKwSearchApiService(@Named("kw_proxy") retrofit: Retrofit): KwSearchApiService {
        return retrofit.create(KwSearchApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideKwUrlProxyApiService(@Named("kw_proxy") retrofit: Retrofit): KwUrlProxyApiService {
        return retrofit.create(KwUrlProxyApiService::class.java)
    }
}
