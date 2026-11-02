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
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 收藏网络歌单（kg/wy）与自建本地歌单（local）。
 * 索引文件 `collected_playlists.json`；仅 local 使用 `songs_<id>.json` 存曲目。
 */
@Singleton
class PlaylistCollectionManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val gson = Gson()
    private val localDb = LocalPlaylistDbStore(context)
    private val favoriteDb = FavoritePlaylistsDbStore(context)
    private val syncOutbox = SyncOutboxStore(context)
    private val indexFileName = "collected_playlists.json"

    private val lock = Any()
    private var indexLoaded = false
    private val playlistsByKey = LinkedHashMap<String, CollectedPlaylist>()

    /** local 歌单 id → 内存中的歌曲列表（与磁盘同步）。 */
    private val localSongsByPlaylistId = LinkedHashMap<String, MutableList<SongInfo>>()
    private val localSongsLoaded = mutableSetOf<String>()

    private val _playlistsFlow = MutableStateFlow<List<CollectedPlaylist>>(emptyList())
    val playlistsFlow: StateFlow<List<CollectedPlaylist>> = _playlistsFlow.asStateFlow()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val persistIndexMutex = Mutex()
    private val persistSongsMutex = Mutex()

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
            if (indexLoaded) return
            migrateLegacyPlaylists()
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
        val legacyPlaylists = readIndexFromDisk()
        favoriteDb.mergeLegacyPlaylists(legacyPlaylists)
        val legacyLocalPlaylists = legacyPlaylists
            .filter { it.type == CollectedPlaylistType.LOCAL && it.id.isNotBlank() }
        if (legacyLocalPlaylists.isEmpty()) return
        for (playlist in legacyLocalPlaylists) {
            // 已入库歌单以 SQLite 为准，过期镜像不可复活已删曲目。
            if (localDb.playlistExists(playlist.id)) continue
            localDb.mergeLegacyPlaylist(
                playlist = playlist,
                songs = readLocalSongsFromDisk(playlist.id).map { it.forPersistence() },
            )
        }
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
        if (type != SongType.LOCAL) return this
        if (embeddedCoverArt == null) return this
        return copy(embeddedCoverArt = null)
    }

    private fun persistIndexAsync() {
        val snapshot = synchronized(lock) {
            playlistsByKey.values.toList()
        }
        scope.launch {
            persistIndexMutex.withLock {
                try {
                    val file = indexFile()
                    file.parentFile?.mkdirs()
                    file.writeText(gson.toJson(snapshot))
                } catch (e: Exception) {
                    Log.e(TAG, "save collected playlists index failed", e)
                }
            }
        }
    }

    private fun persistLocalSongsAsync(playlistId: String) {
        val snapshot = synchronized(lock) {
            localSongsByPlaylistId[playlistId]?.map { it.forPersistence() } ?: emptyList()
        }
        scope.launch {
            persistSongsMutex.withLock {
                try {
                    val file = songsFile(playlistId)
                    file.parentFile?.mkdirs()
                    file.writeText(gson.toJson(snapshot))
                } catch (e: Exception) {
                    Log.e(TAG, "save playlist songs failed id=$playlistId", e)
                }
            }
        }
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

    fun isCollected(type: CollectedPlaylistType, id: String): Boolean {
        if (id.isBlank()) return false
        ensureIndexLoaded()
        synchronized(lock) {
            return playlistsByKey.containsKey(storageKey(type, id))
        }
    }

    fun getCollectedPlaylist(type: CollectedPlaylistType, id: String): CollectedPlaylist? {
        if (id.isBlank()) return null
        ensureIndexLoaded()
        synchronized(lock) {
            return playlistsByKey[storageKey(type, id)]
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

    /**
     * 收藏网络歌单（[CollectedPlaylistType.KG]、[CollectedPlaylistType.WY]、[CollectedPlaylistType.IMPORT_KG]、[CollectedPlaylistType.IMPORT_WY] 等，非 [CollectedPlaylistType.LOCAL]）。
     * 若已存在同 type+id 则忽略。
     */
    fun addNetworkPlaylist(playlist: CollectedPlaylist): Boolean {
        require(playlist.type != CollectedPlaylistType.LOCAL) {
            "use createLocalPlaylist for local playlists"
        }
        if (playlist.id.isBlank()) return false
        ensureIndexLoaded()
        var added = false
        synchronized(lock) {
            val key = storageKey(playlist)
            if (!playlistsByKey.containsKey(key)) {
                added = favoriteDb.addPlaylist(playlist)
                if (added) {
                    playlistsByKey[key] = playlist
                    refreshPlaylistsFlowLocked()
                }
            }
        }
        if (added) persistIndexAsync()
        if (added) enqueueFavoritePlaylist(playlist, SyncPayloads.ACTION_UPSERT)
        return added
    }

    fun removePlaylist(type: CollectedPlaylistType, id: String): Boolean {
        if (id.isBlank()) return false
        ensureIndexLoaded()
        var removed = false
        var removedPlaylist: CollectedPlaylist? = null
        synchronized(lock) {
            val key = storageKey(type, id)
            val removedPl = playlistsByKey.remove(key)
            if (removedPl != null) {
                removedPlaylist = removedPl
                if (type == CollectedPlaylistType.LOCAL) {
                    localDb.removePlaylist(id)
                    MinePlaylistCoverResolver.localFileForCover(removedPl.cover)?.delete()
                    localSongsByPlaylistId.remove(id)
                    localSongsLoaded.remove(id)
                    try {
                        songsFile(id).takeIf { it.exists() }?.delete()
                        MinePlaylistCoverResolver.persistedCoverFile(context, id)
                            .takeIf { it.exists() }
                            ?.delete()
                    } catch (e: Exception) {
                        Log.e(TAG, "delete songs file failed id=$id", e)
                    }
                } else {
                    favoriteDb.removePlaylist(type, id)
                }
                refreshPlaylistsFlowLocked()
                removed = true
            }
        }
        if (removed) persistIndexAsync()
        val snapshot = removedPlaylist
        if (removed && snapshot != null) {
            if (type == CollectedPlaylistType.LOCAL) {
                enqueueUserPlaylist(snapshot, SyncPayloads.ACTION_DELETE)
            } else {
                enqueueFavoritePlaylist(snapshot, SyncPayloads.ACTION_DELETE)
            }
        }
        return removed
    }

    /**
     * 新建自建歌单：type=local，id=随机 UUID，并创建空的 [songs_${id}.json]。
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
        val playlist = CollectedPlaylist(CollectedPlaylistType.LOCAL, id, name, intro, cover, normalized.size)
        ensureIndexLoaded()
        synchronized(lock) {
            localDb.createPlaylistWithSongs(playlist, normalized, syncOutbox)
            playlistsByKey[storageKey(playlist)] = playlist
            localSongsByPlaylistId[id] = normalized.toMutableList()
            localSongsLoaded.add(id)
            refreshPlaylistsFlowLocked()
        }
        persistIndexAsync()
        persistLocalSongsAsync(id)
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
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, id)
            val cur = playlistsByKey[key] ?: return false
            val next = cur.copy(
                name = name ?: cur.name,
                intro = intro ?: cur.intro,
                cover = cover ?: cur.cover,
            )
            if (next != cur) {
                localDb.upsertPlaylist(next)
                playlistsByKey[key] = next
                refreshPlaylistsFlowLocked()
                changed = true
            }
        }
        if (changed) {
            synchronized(lock) {
                playlistsByKey[storageKey(CollectedPlaylistType.LOCAL, id)]?.let {
                    // 本地提交已成功，不能因同步队列失败让调用方回滚封面文件。
                    runCatching { enqueueUserPlaylist(it, SyncPayloads.ACTION_UPSERT) }
                        .onFailure { error -> Log.e(TAG, "enqueue playlist metadata failed", error) }
                }
            }
            persistIndexAsync()
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
            val next = playlist.copy(count = nextSongs.size)
            try {
                localDb.addSongsWithOutbox(next, nextSongs, added, syncOutbox)
            } catch (e: Exception) {
                Log.e(TAG, "add playlist songs transaction failed", e)
                return AddSongsResult(emptyList(), existing, invalid + added)
            }
            playlistsByKey[key] = next
            localSongsByPlaylistId[playlistId] = nextSongs.toMutableList()
            refreshPlaylistsFlowLocked()
        }
        persistIndexAsync()
        persistLocalSongsAsync(playlistId)
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
        var changed = false
        val removedSongs = mutableListOf<SongInfo>()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            if (!playlistsByKey.containsKey(key)) return false
            ensureLocalSongsLoaded(playlistId)
            val list = localSongsByPlaylistId[playlistId] ?: return false
            val idSet = songs.map { it.type to it.id }.toSet()
            removedSongs += list.filter { (it.type to it.id) in idSet }
            if (list.removeAll { (it.type to it.id) in idSet }) {
                changed = true
                updateLocalPlaylistCountLocked(playlistId)
                refreshPlaylistsFlowLocked()
            }
        }
        if (changed) {
            val snapshot = synchronized(lock) {
                localSongsByPlaylistId[playlistId]?.map { it.forPersistence() } ?: emptyList()
            }
            localDb.setSongs(playlistId, snapshot)
            removedSongs.filter { it.type != SongType.LOCAL }.forEach { song ->
                enqueuePlaylistTrack(playlistId, song, SyncPayloads.ACTION_DELETE)
            }
            synchronized(lock) {
                playlistsByKey[storageKey(CollectedPlaylistType.LOCAL, playlistId)]?.let {
                    enqueueUserPlaylist(it, SyncPayloads.ACTION_UPSERT)
                }
            }
            persistIndexAsync()
            persistLocalSongsAsync(playlistId)
        }
        return changed
    }

    /**
     * 覆盖本地歌单曲目顺序与内容（用于排序或全量替换）。
     */
    fun setLocalPlaylistSongs(playlistId: String, songs: List<SongInfo>): Boolean {
        val normalized = songs.filter { it.id.isNotBlank() }.distinctBy { it.type to it.id }
        val previous = getLocalPlaylistSongs(playlistId)
        ensureIndexLoaded()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            if (!playlistsByKey.containsKey(key)) return false
            localSongsByPlaylistId[playlistId] = normalized.toMutableList()
            localSongsLoaded.add(playlistId)
            updateLocalPlaylistCountLocked(playlistId)
            refreshPlaylistsFlowLocked()
        }
        localDb.setSongs(playlistId, normalized.map { it.forPersistence() })
        val retainedKeys = normalized.map { it.type to it.id }.toSet()
        previous.filter { (it.type to it.id) !in retainedKeys }.forEach {
            enqueuePlaylistTrack(playlistId, it, SyncPayloads.ACTION_DELETE)
        }
        normalized.filter { it.type != SongType.LOCAL }.forEach {
            enqueuePlaylistTrack(playlistId, it, SyncPayloads.ACTION_UPSERT)
        }
        persistIndexAsync()
        persistLocalSongsAsync(playlistId)
        return true
    }

    fun upsertPlaylistFromSync(playlist: cn.partialy.pm.model.CanonicalPlaylist, favorite: Boolean) {
        val next = playlist.toCollectedPlaylist()
        if (next.id.isBlank()) return
        ensureIndexLoaded()
        synchronized(lock) {
            playlistsByKey[storageKey(next)] = next
            refreshPlaylistsFlowLocked()
        }
        if (favorite && next.type != CollectedPlaylistType.LOCAL) {
            favoriteDb.addPlaylist(next)
        } else if (next.type == CollectedPlaylistType.LOCAL) {
            localDb.upsertPlaylist(next)
        }
        persistIndexAsync()
    }

    fun removePlaylistFromSync(playlist: cn.partialy.pm.model.CanonicalPlaylist, favorite: Boolean) {
        val next = playlist.toCollectedPlaylist()
        if (next.id.isBlank()) return
        ensureIndexLoaded()
        synchronized(lock) {
            playlistsByKey.remove(storageKey(next))
            refreshPlaylistsFlowLocked()
        }
        if (favorite && next.type != CollectedPlaylistType.LOCAL) {
            favoriteDb.removePlaylist(next.type, next.id)
        } else if (next.type == CollectedPlaylistType.LOCAL) {
            localDb.removePlaylist(next.id)
            localSongsByPlaylistId.remove(next.id)
            localSongsLoaded.remove(next.id)
        }
        persistIndexAsync()
    }

    fun addTrackFromSync(playlistId: String, song: cn.partialy.pm.model.CanonicalSong) {
        if (playlistId.isBlank() || song.source == "local") return
        addSongsToLocalPlaylistFromSync(playlistId, listOf(song.toSongInfo()))
    }

    fun removeTrackFromSync(playlistId: String, song: cn.partialy.pm.model.CanonicalSong) {
        if (playlistId.isBlank()) return
        removeSongsFromLocalPlaylistFromSync(playlistId, listOf(song.toSongInfo()))
    }

    fun clearAll() {
        ensureIndexLoaded()
        synchronized(lock) {
            playlistsByKey.clear()
            localSongsByPlaylistId.clear()
            localSongsLoaded.clear()
            refreshPlaylistsFlowLocked()
        }
        localDb.clearAll()
        favoriteDb.clearAll()
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

    private fun addSongsToLocalPlaylistFromSync(playlistId: String, songs: List<SongInfo>) {
        ensureIndexLoaded()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            if (!playlistsByKey.containsKey(key)) return
            ensureLocalSongsLoaded(playlistId)
            val list = localSongsByPlaylistId.getOrPut(playlistId) { mutableListOf() }
            val existing = list.map { it.type to it.id }.toHashSet()
            songs.forEach { song ->
                if (song.id.isNotBlank() && (song.type to song.id) !in existing) {
                    list.add(song)
                    existing.add(song.type to song.id)
                }
            }
            updateLocalPlaylistCountLocked(playlistId)
            refreshPlaylistsFlowLocked()
        }
        localDb.setSongs(playlistId, getLocalPlaylistSongs(playlistId).map { it.forPersistence() })
        persistIndexAsync()
        persistLocalSongsAsync(playlistId)
    }

    private fun removeSongsFromLocalPlaylistFromSync(playlistId: String, songs: Collection<SongInfo>) {
        ensureIndexLoaded()
        synchronized(lock) {
            val key = storageKey(CollectedPlaylistType.LOCAL, playlistId)
            if (!playlistsByKey.containsKey(key)) return
            ensureLocalSongsLoaded(playlistId)
            val keys = songs.map { it.type to it.id }.toSet()
            localSongsByPlaylistId[playlistId]?.removeAll { (it.type to it.id) in keys }
            updateLocalPlaylistCountLocked(playlistId)
            refreshPlaylistsFlowLocked()
        }
        localDb.setSongs(playlistId, getLocalPlaylistSongs(playlistId).map { it.forPersistence() })
        persistIndexAsync()
        persistLocalSongsAsync(playlistId)
    }

    private fun enqueueFavoritePlaylist(playlist: CollectedPlaylist, action: String) {
        syncOutbox.enqueue(
            itemType = SyncPayloads.TYPE_FAVORITE_PLAYLIST,
            itemKey = SyncPayloads.playlistKey(playlist),
            action = action,
            payloadJson = if (action == SyncPayloads.ACTION_DELETE) "{}" else SyncPayloads.playlistPayload(playlist),
        )
        SyncWorkRunner.request(context)
    }

    private fun enqueueUserPlaylist(playlist: CollectedPlaylist, action: String) {
        if (playlist.type != CollectedPlaylistType.LOCAL) return
        syncOutbox.enqueue(
            itemType = SyncPayloads.TYPE_USER_PLAYLIST,
            itemKey = SyncPayloads.playlistKey(playlist),
            action = action,
            payloadJson = if (action == SyncPayloads.ACTION_DELETE) "{}" else SyncPayloads.playlistPayload(playlist),
        )
        SyncWorkRunner.request(context)
    }

    private fun enqueuePlaylistTrack(playlistId: String, song: SongInfo, action: String) {
        if (song.type == SongType.LOCAL) return
        syncOutbox.enqueue(
            itemType = SyncPayloads.TYPE_PLAYLIST_TRACK,
            itemKey = SyncPayloads.playlistTrackKey(playlistId, song),
            action = action,
            payloadJson = if (action == SyncPayloads.ACTION_DELETE) "{}" else SyncPayloads.songPayload(song),
        )
        SyncWorkRunner.request(context)
    }
}
