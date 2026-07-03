package cn.partialy.pm.utils

import android.content.Context
import android.net.Uri
import cn.partialy.pm.model.SongInfo
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocalSongProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val localSongStore: LocalSongStore,
) {
    fun refreshLocalSongs(): List<SongInfo> {
        localSongStore.syncMediaStore()
        return localSongStore.querySongs()
    }

    fun queryLocalSongs(): List<SongInfo> {
        return localSongStore.querySongs()
    }

    fun importSongs(uris: List<Uri>): LocalSongImportResult {
        return localSongStore.importSongs(uris)
    }

    fun scanMediaStoreSongs(filterShortSongs: Boolean): List<LocalSongScanCandidate> {
        return localSongStore.scanMediaStoreSongs(filterShortSongs)
    }

    fun scanDocumentTreeSongs(
        treeUri: Uri,
        filterShortSongs: Boolean,
    ): List<LocalSongScanCandidate> {
        return localSongStore.scanDocumentTreeSongs(treeUri, filterShortSongs)
    }

    fun importScannedSongs(candidates: List<LocalSongScanCandidate>): LocalSongImportResult {
        return localSongStore.importScannedSongs(candidates)
    }
}
