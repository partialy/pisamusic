package cn.partialy.pm.di

import android.content.Context
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.ImageLoader
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    
    @Provides
    @Singleton
    fun provideLoveManager(@ApplicationContext context: Context): LoveManager {
        return LoveManager(context)
    }

    @Provides
    @Singleton
    fun providePlaylistCollectionManager(@ApplicationContext context: Context): PlaylistCollectionManager {
        return PlaylistCollectionManager(context)
    }

    @Provides
    @Singleton
    fun provideImageLoader(@ApplicationContext context: Context): ImageLoader {
        return ImageLoader.Builder(context)
            .crossfade(true)
            .build()
    }
} 