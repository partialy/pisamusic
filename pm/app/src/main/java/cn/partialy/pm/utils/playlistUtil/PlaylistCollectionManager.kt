package cn.partialy.pm.utils.playlistUtil

import android.content.Context
import android.util.Log
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.decodeSongInfoListCompat
import cn.partialy.pm.model.toCollectedPlaylist
import cn.partialy.pm.model.toSongInfo
import cn.partialy.pm.sync.SyncOutboxStore
import cn.partialy.pm.sync.SyncPayloads
import cn.partialy.pm.sync.SyncWorkRunner
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 收藏网络歌单（kg/wy）与自建本地歌单（local）。
 * SQLite 为唯一运行存储；旧 JSON 只作一次迁移与显式备份。
 */
@Singleton
class PlaylistCollectionManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val gson = Gson()
    private val localDb = LocalPlaylistDbStore(context)
    private val coverEdits = cn.partialy.pm.playlistcover.PlaylistCoverStore(context)
    private val favoriteDb = FavoritePlaylistsDbStore(context)
    private val syncOutbox = SyncOutboxStore(context)
    private val indexFileName = "collected_playlists.json"
    private val migrationPrefs = context.getSharedPreferences("pm_playlist_migration", Context.MODE_PRIVATE)
    private val localSyncTracks = cn.partialy.pm.sync.LocalSyncTrackStore(context)

    private val accountScope = cn.partialy.pm.sync.LibraryAccountScope(context)
    private var loadedAccount: String? = null
    private val lock = cn.partialy.pm.network.auth.AccountSessionStore.libraryBoundary
    private var indexLoaded = false
    private val playlistsByKey = LinkedHashMap<String, CollectedPlaylist>()

    /** local 歌单 id → 内存中的歌曲列表（与磁盘同步）。 */
    private val localSongsByPlaylistId = LinkedHashMap<String, MutableList<SongInfo>>()
    private val localSongsLoaded = mutableSetOf<String>()

    private val _playlistsFlow = MutableStateFlow<List<CollectedPlaylist>>(emptyList())
    val playlistsFlow: StateFlow<List<CollectedPlaylist>> = _playlistsFlow.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    init {
        cn.partialy.pm.network.auth.AccountSessionStore.onLibraryAccountChanged {
            synchronized(lock) {
                indexLoaded = false
                _playlistsFlow.value = emptyList()
            }
            reload()
        }
    }

    private fun indexFile(): File = File(context.filesDir, indexFileName)

    private fun songsFile(playlistId: String): File =
        File(context.filesDir, "songs_${playlistId}.json")

    private fun storageKey(type: CollectedPlaylistType, id: String): String =
        "${type.name.lowercase()}:$id"

    private fun storageKey(playlist: CollectedPlaylist): String =
        storageKey(playlist.type, playlist.id)

    private fun readIndexFromDisk(): List<CollectedPlaylist> {
        return try {
            val file = indexFile()
            if (!file.exists()) return emptyList()
            val content = file.readText()
            if (content.isBlank()) return emptyList()
            gson.fromJson(content, Array<CollectedPlaylist>::class.java).toList()
        } catch (e: Exception) {
            Log.e(TAG, "read collected playlists index failed", e)
            emptyList()
        }
    }

    private fun ensureIndexLoaded() {
        synchronized(lock) {
            val currentAccount = accountScope.current()
            if (indexLoaded && loadedAccount == currentAccount) return
            loadedAccount = currentAccount
            migrateLegacyPlaylists()
            localSongsLoaded.clear()
            localSongsByPlaylistId.clear()
            playlistsByKey.clear()
            for (p in favoriteDb.getPlaylists()) {
                if (p.id.isNotBlank()) playlistsByKey[storageKey(p)] = p
            }
            for (p in localDb.getPlaylists()) {
                if (p.id.isNotBlank()) playlistsByKey[storageKey(p)] = p
            }
            refreshPlaylistsFlowLocked()
            indexLoaded = true
        }
    }

    private fun migrateLegacyPlaylists() {
        if (migrationPrefs.getBoolean("sqlite_authoritative", false)) return
        val legacyPlaylists = readIndexFromDisk()
        favoriteDb.mergeLegacyPlaylists(legacyPlaylists)
        val legacyLocalPlaylists = legacyPlaylists
            .filter { it.type == CollectedPlaylistType.LOCAL && it.id.isNotBlank() }

        for (playlist in legacyLocalPlaylists) {
            // 已入库歌单以 SQLite 为准，过期镜像不可复活已删曲目。
            if (localDb.playlistExists(playlist.id, anyScope = true)) continue
            localDb.mergeLegacyPlaylist(
                playlist = playlist,
                songs = readLocalSongsFromDisk(playlist.id).map { it.forPersistence() },
            )
        }
        check(migrationPrefs.edit().putBoolean("sqlite_authoritative", true).commit())
    }

    /** 在 IO 线程读索引预热内存（仅首次有效），供主界面启动后调用。 */
    /** 强制从磁盘重新加载索引（数据管理导入后调用） */
    fun reload() {
        synchronized(lock) {
            indexLoaded = false
            localSongsLoaded.clear()
            localSongsByPlaylistId.clear()
            ensureIndexLoaded()
        }
    }

    fun preloadIndexFromDiskAsync() {
        scope.launch {
            ensureIndexLoaded()
        }
    }

    private fun refreshPlaylistsFlowLocked() {
        _playlistsFlow.value = playlistsByKey.values.toList()
    }

    private fun SongInfo.forPersistence(): SongInfo {
        return localSyncTracks.bind(this)
    }

    private fun readLocalSongsFromDisk(playlistId: String): List<SongInfo> {
        return try {
            val file = songsFile(playlistId)
            if (!file.exists()) return emptyList()
            val content = file.readText()
            if (content.isBlank()) return emptyList()
            gson.decodeSongInfoListCompat(content)
        } catch (e: Exception) {
            Log.e(TAG, "read playlist songs failed id=$playlistId", e)
            emptyList()
        }
    }

    private fun ensureLocalSongsLoaded(playlistId: String) {
        synchronized(lock) {
            if (localSongsLoaded.contains(playlistId)) return
            localSongsByPlaylistId[playlistId] = localDb.getSongs(playlistId).toMutableList()
            localSongsLoaded.add(playlistId)
        }
    }

    private fun updateLocalPlaylistCountLocked(playlistId: String) {
        val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
        val existing = playlistsByKey[key] ?: return
        val n = localSongsByPlaylistId[playlistId]?.size ?: 0
        playlistsByKey[key] = existing.copy(count = n)
    }

    fun getAllPlaylists(): List<CollectedPlaylist> {
        ensureIndexLoaded()
        synchronized(lock) {
            return playlistsByKey.values.toList()
        }
    }

    internal fun getLocalPlaylistTimestamps(): Map<String, Long> = synchronized(lock) {
        localDb.getPlaylistUpdatedAtMap()
    }

    internal fun getLocalPlaylistSongTimestamps(playlistId: String): Map<String, Long> = synchronized(lock) {
        localDb.getSongUpdatedAtMap(playlistId)
    }

    /** 将 SQLite 中的本地歌单同步成旧版 JSON 文件，保持备份导出兼容。 */
    fun syncLegacyMirrorNow() {
        val playlists = getAllPlaylists()
        try {
            val index = indexFile()
            index.parentFile?.mkdirs()
            index.writeText(gson.toJson(playlists))
            playlists
                .filter { it.type == CollectedPlaylistType.LOCAL }
                .forEach { playlist ->
                    songsFile(playlist.id).writeText(
                        gson.toJson(localDb.getSongs(playlist.id).map { it.forPersistence() })
                    )
                }
        } catch (e: Exception) {
            Log.e(TAG, "sync legacy playlist mirror failed", e)
        }
    }

    private fun CollectedPlaylistType.canonicalStorageType(): CollectedPlaylistType = when (this) {
        CollectedPlaylistType.KG, CollectedPlaylistType.IMPORT_KG -> CollectedPlaylistType.KG
        CollectedPlaylistType.WY, CollectedPlaylistType.IMPORT_WY -> CollectedPlaylistType.WY
        CollectedPlaylistType.LOCAL -> CollectedPlaylistType.LOCAL
    }

    fun isCollected(type: CollectedPlaylistType, id: String): Boolean {
        if (id.isBlank()) return false
        ensureIndexLoaded()
        synchronized(lock) {
            return playlistsByKey.containsKey(storageKey(type.canonicalStorageType(), id)) ||
                playlistsByKey.containsKey(storageKey(type, id))
        }
    }

    fun getCollectedPlaylist(type: CollectedPlaylistType, id: String): CollectedPlaylist? {
        if (id.isBlank()) return null
        ensureIndexLoaded()
        synchronized(lock) {
            return playlistsByKey[storageKey(type.canonicalStorageType(), id)]
                ?: playlistsByKey[storageKey(type, id)]
        }
    }

    /** 酷狗收藏或导入歌单在索引中的实际条目（[KG] 与 [IMPORT_KG] 二选一）。 */
    fun findKgLikeCollected(id: String): CollectedPlaylist? {
        if (id.isBlank()) return null
        ensureIndexLoaded()
        synchronized(lock) {
            return playlistsByKey[storageKey(CollectedPlaylistType.KG, id)]
                ?: playlistsByKey[storageKey(CollectedPlaylistType.IMPORT_KG, id)]
        }
    }

    /** 网易收藏或导入歌单在索引中的实际条目。 */
    fun findWyLikeCollected(id: String): CollectedPlaylist? {
        if (id.isBlank()) return null
        ensureIndexLoaded()
        synchronized(lock) {
            return playlistsByKey[storageKey(CollectedPlaylistType.WY, id)]
                ?: playlistsByKey[storageKey(CollectedPlaylistType.IMPORT_WY, id)]
        }
    }

    data class BatchImportResult(
        val added: Int,
        val skipped: Int,
    )

    /**
     * 收藏网络歌单（[CollectedPlaylistType.KG]、[CollectedPlaylistType.WY]、[CollectedPlaylistType.IMPORT_KG]、[CollectedPlaylistType.IMPORT_WY] 等，非 [CollectedPlaylistType.LOCAL]）。
     * 写入前统一归一化为规范源类型 [KG] / [WY]，与 SQLite 读取及同步模型保持一致；若同源同 id 已存在则忽略。
     */
    fun addNetworkPlaylist(playlist: CollectedPlaylist): Boolean {
        return addNetworkPlaylists(listOf(playlist)).added > 0
    }

    /**
     * 批量增量导入网络歌单（单次 SQLite 事务与单次同步触发）。
     */
    fun addNetworkPlaylists(playlists: List<CollectedPlaylist>): BatchImportResult {
        if (playlists.isEmpty()) return BatchImportResult(added = 0, skipped = 0)
        ensureIndexLoaded()
        var added = 0
        var skipped = 0
        synchronized(lock) {
            val candidatesToInsert = ArrayList<CollectedPlaylist>(playlists.size)
            val plannedKeys = HashSet<String>()
            for (playlist in playlists) {
                require(playlist.type != CollectedPlaylistType.LOCAL) {
                    "use createLocalPlaylist for local playlists"
                }
                if (playlist.id.isBlank()) {
                    skipped++
                    continue
                }
                val normalized = playlist.copy(type = playlist.type.canonicalStorageType())
                val key = storageKey(normalized)
                val aliasKey = storageKey(playlist)
                if (playlistsByKey.containsKey(key) ||
                    playlistsByKey.containsKey(aliasKey) ||
                    !plannedKeys.add(key)
                ) {
                    skipped++
                    continue
                }
                candidatesToInsert.add(normalized)
            }
            if (candidatesToInsert.isNotEmpty()) {
                val inserted = favoriteDb.addPlaylists(candidatesToInsert)
                added = inserted.size
                skipped += candidatesToInsert.size - added
                for (saved in inserted) {
                    playlistsByKey[storageKey(saved)] = saved
                }
                if (added > 0) {
                    refreshPlaylistsFlowLocked()
                }
            }
        }
        if (added > 0) SyncWorkRunner.request(context)
        return BatchImportResult(added = added, skipped = skipped)
    }

    fun removePlaylist(type: CollectedPlaylistType, id: String): Boolean {
        if (id.isBlank()) return false
        ensureIndexLoaded()
        var removed = false
        synchronized(lock) {
            val canonicalType = type.canonicalStorageType()
            val canonicalKey = storageKey(canonicalType, id)
            val rawKey = storageKey(type, id)
            val removedPl = playlistsByKey[canonicalKey] ?: playlistsByKey[rawKey]
            if (removedPl != null) {
                if (canonicalType == CollectedPlaylistType.LOCAL) {
                    val previousCoverReferences = localDb.allCoverReferences()
                    localDb.removeWithOutbox(removedPl, syncOutbox)
                    localSongsByPlaylistId.remove(id)
                    localSongsLoaded.remove(id)
                    cleanupReleasedCovers(previousCoverReferences)
                } else {
                    favoriteDb.removePlaylist(canonicalType, id)
                }
                playlistsByKey.remove(canonicalKey)
                playlistsByKey.remove(rawKey)
                refreshPlaylistsFlowLocked()
                removed = true
            }
        }
        if (removed) SyncWorkRunner.request(context)
        return removed
    }

    /**
     * 新建自建歌单：type=local，id=随机 UUID，SQLite 原子保存。
     */
    fun createLocalPlaylist(
        name: String,
        intro: String = "",
        cover: String = "",
    ): String {
        return createLocalPlaylistWithSongs(name, emptyList(), intro, cover)
    }

    /** IO 线程调用。SQLite 提交后才发布内存、镜像和同步；失败抛出且不留下半个歌单。 */
    fun createLocalPlaylistWithSongs(
        name: String,
        songs: List<SongInfo>,
        intro: String = "",
        cover: String = "",
    ): String {
        val id = UUID.randomUUID().toString()
        val normalized = songs.filter { it.id.isNotBlank() }.distinctBy { it.type to it.id }
            .map { it.forPersistence() }
        val playlist = CollectedPlaylist(CollectedPlaylistType.LOCAL, id, name, intro, cover, normalized.size,
            coverPreset = cover.takeIf { it.startsWith("local_") && !it.startsWith("local_file:") },
            coverResourcePresent = true, coverPresetPresent = true)
        ensureIndexLoaded()
        synchronized(lock) {
            localDb.createPlaylistWithSongs(playlist, normalized, syncOutbox)
            playlistsByKey[storageKey(playlist)] = playlist
            localSongsByPlaylistId[id] = normalized.toMutableList()
            localSongsLoaded.add(id)
            refreshPlaylistsFlowLocked()
        }
        cn.partialy.pm.playlistcover.PlaylistCoverWork.request(context)
        runCatching { SyncWorkRunner.request(context) }
            .onFailure { Log.e(TAG, "schedule playlist sync failed; outbox retained", it) }
        return id
    }

    /** 更新本地歌单元信息（不含曲目列表）。 */
    fun updateLocalPlaylistMeta(
        id: String,
        name: String? = null,
        intro: String? = null,
        cover: String? = null,
    ): Boolean {
        if (id.isBlank()) return false
        ensureIndexLoaded()
        var changed = false
        val previousCoverReferences=localDb.allCoverReferences()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, id)
            val cur = playlistsByKey[key] ?: return false
            val coverChanged = cover != null && cover != cur.cover
            val next = cur.copy(
                name = name ?: cur.name,
                intro = intro ?: cur.intro,
                cover = cover ?: cur.cover,
                coverResource = if (coverChanged) null else cur.coverResource,
                coverPreset = if (coverChanged) cover?.takeIf { it.startsWith("local_") && !it.startsWith("local_file:") } else cur.coverPreset,
                coverResourcePresent = coverChanged || cur.coverResourcePresent,
                coverPresetPresent = coverChanged || cur.coverPresetPresent,
            )
            if (next != cur) {
                localDb.updateWithOutbox(next, syncOutbox)
                playlistsByKey[key] = next
                refreshPlaylistsFlowLocked()
                changed = true
            }
        }
        if (changed) {
            val referenced=localDb.allCoverReferences()
            (previousCoverReferences-referenced.toSet()).forEach { old ->
                runCatching { MinePlaylistCoverResolver.deletePersistedCoverIfUnused(context,old,referenced) }
            }
            SyncWorkRunner.request(context)
            cn.partialy.pm.playlistcover.PlaylistCoverWork.request(context)
        }
        return changed
    }

    fun getLocalPlaylistSongs(playlistId: String): List<SongInfo> {
        ensureIndexLoaded()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            if (!playlistsByKey.containsKey(key)) return emptyList()
            ensureLocalSongsLoaded(playlistId)
            return localSongsByPlaylistId[playlistId]?.toList() ?: emptyList()
        }
    }

    data class AddSongsResult(val added: List<SongInfo>, val existing: List<SongInfo>, val failed: List<SongInfo>)

    fun addSongsToLocalPlaylist(playlistId: String, songs: List<SongInfo>): Boolean =
        addSongsToLocalPlaylistWithResult(playlistId, songs).added.isNotEmpty()

    /** 以事务提交结果判定成功，失败时不改变内存及镜像。 */
    fun addSongsToLocalPlaylistWithResult(playlistId: String, songs: List<SongInfo>): AddSongsResult {
        if (songs.isEmpty()) return AddSongsResult(emptyList(), emptyList(), emptyList())
        ensureIndexLoaded()
        val added = mutableListOf<SongInfo>()
        val existing = mutableListOf<SongInfo>()
        val invalid = mutableListOf<SongInfo>()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            val playlist = playlistsByKey[key] ?: return AddSongsResult(emptyList(), emptyList(), songs)
            ensureLocalSongsLoaded(playlistId)
            val before = localSongsByPlaylistId[playlistId].orEmpty()
            val identities = before.map { it.type to it.id }.toHashSet()
            songs.forEach { song ->
                when {
                    song.id.isBlank() -> invalid.add(song)
                    !identities.add(song.type to song.id) -> existing.add(song)
                    else -> added.add(song)
                }
            }
            if (added.isEmpty()) return AddSongsResult(emptyList(), existing, invalid)
            val nextSongs = (before + added).map { it.forPersistence() }
            val autoCover = LocalPlaylistAutoCoverRules.fromLastAddedSong(added)
            val next = playlist.copy(count = nextSongs.size, cover = autoCover ?: playlist.cover,
                coverResource = if (autoCover != null) null else playlist.coverResource,
                coverPreset = if (autoCover != null) null else playlist.coverPreset,
                coverResourcePresent = autoCover != null || playlist.coverResourcePresent,
                coverPresetPresent = autoCover != null || playlist.coverPresetPresent)
            val previousCoverReferences = if (autoCover != null) localDb.allCoverReferences() else emptyList()
            try {
                localDb.addSongsWithOutbox(next, added, syncOutbox)
            } catch (e: Exception) {
                Log.e(TAG, "add playlist songs transaction failed", e)
                return AddSongsResult(emptyList(), existing, invalid + added)
            }
            playlistsByKey[key] = next
            localSongsByPlaylistId[playlistId] = nextSongs.toMutableList()
            cleanupReleasedCovers(previousCoverReferences)
            refreshPlaylistsFlowLocked()
        }
        cn.partialy.pm.playlistcover.PlaylistCoverWork.request(context)
        runCatching { SyncWorkRunner.request(context) }
            .onFailure { Log.e(TAG, "schedule playlist sync failed; outbox retained", it) }
        return AddSongsResult(added, existing, invalid)
    }


    /** 兼容旧调用；存在异源同 ID 时不猜测删除对象。 */
    fun removeSongsFromLocalPlaylist(playlistId: String, songIds: Collection<String>): Boolean {
        val byId = getLocalPlaylistSongs(playlistId).groupBy { it.id }
        return removeSongsFromLocalPlaylistByIdentity(playlistId, songIds.mapNotNull { byId[it]?.singleOrNull() })
    }

    fun removeSongsFromLocalPlaylistByIdentity(playlistId: String, songs: Collection<SongInfo>): Boolean {
        if (songs.isEmpty()) return false
        ensureIndexLoaded()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL,playlistId)
            val parent = playlistsByKey[key] ?: return false
            ensureLocalSongsLoaded(playlistId)
            val previous = localSongsByPlaylistId[playlistId].orEmpty()
            val identities = songs.map { it.type to it.id }.toSet()
            val removed = previous.filter { (it.type to it.id) in identities }
            if (removed.isEmpty()) return false
            localDb.removeTracksWithOutbox(playlistId,removed,syncOutbox)
            val retained = previous.filterNot { (it.type to it.id) in identities }
            localSongsByPlaylistId[playlistId] = retained.toMutableList()
            playlistsByKey[key] = parent.copy(count=retained.size)
            refreshPlaylistsFlowLocked()
        }
        SyncWorkRunner.request(context)
        return true
    }

    /**
     * 覆盖本地歌单曲目顺序与内容（用于排序或全量替换）。
     */
    fun setLocalPlaylistSongs(playlistId: String, songs: List<SongInfo>): Boolean {
        ensureIndexLoaded()
        val normalized = songs.filter { it.id.isNotBlank() }.distinctBy { it.type to it.id }.map { it.forPersistence() }
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            val previous = playlistsByKey[key] ?: return false
            localDb.replaceWithOutbox(playlistId, normalized, syncOutbox)
            localSongsByPlaylistId[playlistId] = normalized.toMutableList()
            localSongsLoaded.add(playlistId)
            playlistsByKey[key] = previous.copy(count = normalized.size, localRevision = previous.localRevision + 1)
            refreshPlaylistsFlowLocked()
        }
        SyncWorkRunner.request(context)
        return true
    }

    fun <T> withSyncGuard(accountId: String, itemType: String, itemKey: String, action: () -> T): T? {
        ensureIndexLoaded()
        synchronized(lock) {
            if (syncOutbox.accountSnapshot() != accountId || syncOutbox.hasPending(accountId, itemType, itemKey)) return null
            if (itemType == SyncPayloads.TYPE_USER_PLAYLIST && syncOutbox.hasPendingPlaylist(accountId, itemKey.substringAfter(":"))) return null
            return action()
        }
    }

    fun upsertPlaylistFromSync(playlist: cn.partialy.pm.model.CanonicalPlaylist, favorite: Boolean, ownEcho: Boolean = false, documentClock: Long = 0) {
        var next = playlist.toCollectedPlaylist()
        if (next.id.isBlank()) return
        ensureIndexLoaded()
        synchronized(lock) {
            val prior = playlistsByKey[storageKey(next)]
            next = next.copy(
                coverResource = if (next.coverResourcePresent) next.coverResource else prior?.coverResource,
                coverPreset = if (next.coverPresetPresent) next.coverPreset else prior?.coverPreset,
                coverResourcePresent = next.coverResourcePresent || prior?.coverResourcePresent == true,
                coverPresetPresent = next.coverPresetPresent || prior?.coverPresetPresent == true,
            )
            if (favorite && next.type != CollectedPlaylistType.LOCAL) favoriteDb.upsertFromSync(next)
            else if (next.type == CollectedPlaylistType.LOCAL) {
                val oldReferences = localDb.allCoverReferences()
                val old = prior?.cover
                next = localDb.upsertFromSync(next,ownEcho,documentClock)
                val newReferences = localDb.allCoverReferences()
                (oldReferences - newReferences.toSet() + listOfNotNull(old)).forEach {
                    MinePlaylistCoverResolver.deletePersistedCoverIfUnused(context,it,newReferences)
                }
            }
            if (next.cover.isBlank() && next.coverPreset != null) next = next.copy(cover = "preset:${next.coverPreset}")
            playlistsByKey[storageKey(next)] = next
            refreshPlaylistsFlowLocked()
        }
    }

    fun removePlaylistFromSync(playlist: cn.partialy.pm.model.CanonicalPlaylist, favorite: Boolean) {
        val next = playlist.toCollectedPlaylist()
        if (next.id.isBlank()) return
        ensureIndexLoaded()
        synchronized(lock) {
            if (favorite && next.type != CollectedPlaylistType.LOCAL) favoriteDb.removePlaylist(next.type, next.id, recordChange = false)
            else if (next.type == CollectedPlaylistType.LOCAL) {
                val previousCoverReferences = localDb.allCoverReferences()
                localDb.removePlaylist(next.id)
                localDb.markParentDeleted(playlistId = next.id)
                localSongsByPlaylistId.remove(next.id)
                localSongsLoaded.remove(next.id)
                cleanupReleasedCovers(previousCoverReferences)
            }
            playlistsByKey.remove(storageKey(next))
            refreshPlaylistsFlowLocked()
        }
    }

    fun applyTrackFromSync(playlistId: String, song: cn.partialy.pm.model.CanonicalSong, delete: Boolean, order: Long?, version: Long) {
        ensureIndexLoaded()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            val parent = playlistsByKey[key] ?: return
            localDb.applyTrack(playlistId, song.toSongInfo(), delete, order, version)
            val songs = localDb.getSongs(playlistId)
            localSongsByPlaylistId[playlistId] = songs.toMutableList()
            localSongsLoaded.add(playlistId)
            playlistsByKey[key] = parent.copy(count = songs.size, localRevision = parent.localRevision + 1)
            refreshPlaylistsFlowLocked()
        }
    }

    fun acknowledgeTrackVersion(playlistId: String, song: cn.partialy.pm.model.CanonicalSong, version: Long) {
        ensureIndexLoaded()
        synchronized(lock) {
            if (!localDb.playlistExists(playlistId)) return
            localDb.acknowledgeTrackVersion(playlistId,song.toSongInfo(),version)
            localSongsByPlaylistId[playlistId] = localDb.getSongs(playlistId).toMutableList()
            localSongsLoaded.add(playlistId)
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            playlistsByKey[key]?.let { playlistsByKey[key] = it.copy(localRevision = it.localRevision + 1) }
            refreshPlaylistsFlowLocked()
        }
    }

    fun <T> withDataLock(action: () -> T): T = synchronized(lock) { action() }


    fun playlistCoverUploadStatus(id: String): String = synchronized(lock) {
        coverEdits.get(accountScope.current(),id)?.let { edit -> when(edit.state) {
            "FAILED" -> edit.error.ifBlank { "封面上传失败，可重试或恢复默认" }
            "QUEUED" -> "封面已在本机保存，等待联网上传"
            "UPLOADED" -> "封面文件已上传，等待确认"
            "READY" -> "封面已上传，等待同步引用"
            else -> ""
        } }.orEmpty()
    }

    fun retryPlaylistCoverUpload(id: String): Boolean = synchronized(lock) {
        if(!localDb.playlistExists(id)) return@synchronized false
        val changed=coverEdits.retry(accountScope.current(),id)
        if(changed) { reload(); cn.partialy.pm.playlistcover.PlaylistCoverWork.request(context); SyncWorkRunner.request(context) }
        changed
    }

    fun allLocalCoverReferences(): List<String> = synchronized(lock) { localDb.allCoverReferences() }

    /** 提交后用全账号/未关联及 fallback 引用差集回收旧私有图，不能只看已变成 HTTPS 的公开 cover。 */
    private fun cleanupReleasedCovers(previous: Collection<String>) {
        if (previous.isEmpty()) return
        runCatching {
            val referenced = localDb.allCoverReferences()
            (previous.toSet() - referenced.toSet()).forEach { old ->
                MinePlaylistCoverResolver.deletePersistedCoverIfUnused(context, old, referenced)
            }
        }.onFailure { Log.w(TAG, "cleanup released playlist covers failed", it) }
    }

    fun clearAll() {
        ensureIndexLoaded()
        synchronized(lock) {
            val previousCoverReferences = localDb.allCoverReferences()
            localDb.clearAll()
            cleanupReleasedCovers(previousCoverReferences)
            favoriteDb.clearAll()
            playlistsByKey.clear()
            localSongsByPlaylistId.clear()
            localSongsLoaded.clear()
            refreshPlaylistsFlowLocked()
        }
        try {
            context.filesDir.listFiles()
                ?.filter { it.name.startsWith("songs_") && it.name.endsWith(".json") }
                ?.forEach { it.delete() }
        } catch (e: Exception) {
            Log.e(TAG, "delete songs files in clearAll failed", e)
        }
        try {
            indexFile().takeIf { it.exists() }?.delete()
        } catch (e: Exception) {
            Log.e(TAG, "delete playlist index in clearAll failed", e)
        }
    }

    private companion object {
        private const val TAG = "PlaylistCollectionMgr"
    }

}
