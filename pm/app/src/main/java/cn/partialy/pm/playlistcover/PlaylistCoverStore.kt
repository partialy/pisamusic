package cn.partialy.pm.playlistcover

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.*
import cn.partialy.pm.sync.SyncOutboxStore
import cn.partialy.pm.sync.SyncPayloads
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import com.google.gson.Gson
import java.util.UUID

/** 封面任务与 fallback 均私有；不保存七牛 token，不替代歌单本身。 */
internal class PlaylistCoverStore(context: Context) {
    private val helper = LocalMusicDbOpenHelper.shared(context)
    private val outbox = SyncOutboxStore(context)
    data class Edit(val account: String, val playlist: String, val generation: String,
        val expected: String, val fallback: String, val resourceId: String, val resourceUrl: String,
        val uploadId: String, val state: String, val attempts: Int, val error: String, val clock: Long)

    fun get(account: String, playlist: String): Edit? = read(helper.readableDatabase, account, playlist)

    fun pending(account: String): List<Edit> = helper.readableDatabase.rawQuery(
        "SELECT playlist_id FROM playlist_cover_edits WHERE account_id=? AND state IN ('QUEUED','UPLOADED','READY') AND attempts < 5", arrayOf(account)
    ).use { c -> buildList { while (c.moveToNext()) get(account,c.getString(0))?.let(::add) } }

    fun initialize(account: String) = transaction { db ->
        db.rawQuery("SELECT id,updated_at FROM local_playlists WHERE owner_account_id=?",arrayOf(account)).use { c ->
            while (c.moveToNext()) if (read(db,account,c.getString(0)) == null)
                recordLocalEdit(db,account,c.getString(0),c.getLong(1))
        }
    }

    fun update(edit: Edit, values: ContentValues): Boolean = helper.writableDatabase.update(
        "playlist_cover_edits",values,"account_id=? AND playlist_id=? AND generation=?",
        arrayOf(edit.account,edit.playlist,edit.generation)) == 1

    fun failure(edit: Edit, error: String, permanent: Boolean) = update(edit,ContentValues().apply {
        put("attempts",edit.attempts + 1)
        put("last_error",error.take(200))
        if (permanent || edit.attempts + 1 >= 5) put("state","FAILED")
    })

    fun retry(account: String, playlist: String): Boolean = transaction { db ->
        val edit = read(db,account,playlist) ?: return@transaction false
        if (edit.fallback.isBlank()) return@transaction false
        // 新上传代次使旧会话结果失效；重传不伪造文档编辑时间。
        val current = playlist(db,account,playlist) ?: return@transaction false
        val next = current.copy(cover=edit.fallback,coverResource=null,coverPreset=null,
            coverResourcePresent=true,coverPresetPresent=true)
        writePlaylist(db,account,next)
        db.update("playlist_cover_edits",ContentValues().apply {
            put("generation",UUID.randomUUID().toString()); put("expected_cover",edit.fallback)
            put("resource_id",""); put("resource_url",""); put("upload_id","")
            put("state","QUEUED"); put("attempts",0); put("last_error","")
        },"account_id=? AND playlist_id=?",arrayOf(account,playlist))
        outbox.enqueueInTransaction(db,account,SyncPayloads.TYPE_USER_PLAYLIST,"local:$playlist",
            SyncPayloads.ACTION_UPSERT,SyncPayloads.playlistPayload(next),edit.clock,false)
        true
    }

    fun saveReady(edit: Edit, resource: CoverResource): Boolean = update(edit,ContentValues().apply {
        put("resource_id",resource.resourceId); put("resource_url",resource.url)
        put("upload_id",resource.uploadId); put("state","READY"); put("last_error","")
    })

    /** 网络在事务外。这里重读最新名称/描述及真实编辑时钟，引用、URL、outbox 一次提交。 */
    fun link(edit: Edit): Boolean = transaction { db ->
        val latest = read(db,edit.account,edit.playlist) ?: return@transaction false
        if (latest.generation != edit.generation || latest.state != "READY") return@transaction false
        val current = playlist(db,edit.account,edit.playlist) ?: return@transaction false
        if (current.cover != latest.expected || current.coverResource != null) return@transaction false
        val next = current.copy(cover=latest.resourceUrl,coverResource=CanonicalCoverResource(latest.resourceId),
            coverPreset=null,coverResourcePresent=true,coverPresetPresent=true)
        writePlaylist(db,edit.account,next)
        outbox.enqueueInTransaction(db,edit.account,SyncPayloads.TYPE_USER_PLAYLIST,"local:${edit.playlist}",
            SyncPayloads.ACTION_UPSERT,SyncPayloads.playlistPayload(next),latest.clock,false)
        update(latest,ContentValues().apply { put("expected_cover",next.cover); put("state","LINKED") })
        true
    }

    /** 只有 query 明确 400 后撤销失效引用；改写同资源 pending 保留原 opId/真实时间，避免整批永久卡死。 */
    fun invalidate(account: String, id: String, resourceId: String): Boolean = transaction { db ->
        val current = playlist(db,account,id) ?: return@transaction false
        if (current.coverResource?.resourceId != resourceId) return@transaction false
        if (read(db,account,id) == null) recordLocalEdit(db,account,id,documentClock(db,account,id))
        val edit = read(db,account,id)
        val fallback = edit?.fallback.orEmpty()
        val next = current.copy(cover=fallback,coverResource=null,coverPreset=null,
            coverResourcePresent=true,coverPresetPresent=true)
        writePlaylist(db,account,next)
        db.rawQuery("SELECT id,payload_json FROM sync_outbox WHERE account_id=? AND item_type=? AND item_key=?",
            arrayOf(account,SyncPayloads.TYPE_USER_PLAYLIST,"local:$id")).use { c ->
            while(c.moveToNext()) {
                val payload = runCatching { com.google.gson.JsonParser().parse(c.getString(1)).asJsonObject }.getOrNull() ?: continue
                val resource = payload.get("coverResource")?.takeIf { it.isJsonObject }?.asJsonObject
                if (resource?.get("resourceId")?.asString != resourceId) continue
                payload.add("coverResource",com.google.gson.JsonNull.INSTANCE)
                payload.add("coverPreset",com.google.gson.JsonNull.INSTANCE)
                payload.addProperty("cover","")
                db.update("sync_outbox",ContentValues().apply { put("payload_json",payload.toString()) },"id=?",arrayOf(c.getLong(0).toString()))
            }
        }
        if (edit != null) update(edit,ContentValues().apply {
            put("generation",UUID.randomUUID().toString()); put("expected_cover",fallback)
            put("resource_id",""); put("resource_url",""); put("upload_id","")
            put("state","FAILED"); put("last_error",if(fallback.isNotBlank()) "云端封面已失效，可重传或恢复默认" else "云端封面已失效，请重新选图或恢复默认")
        })
        true
    }

    fun privateFallback(account: String, url: String): String? = helper.readableDatabase.rawQuery(
        "SELECT fallback FROM playlist_cover_edits WHERE account_id=? AND resource_url=? AND fallback<>'' LIMIT 1",arrayOf(account,url)
    ).use { if(it.moveToFirst()) it.getString(0) else null }

    fun references(): List<String> = helper.readableDatabase.rawQuery(
        "SELECT fallback FROM playlist_cover_edits WHERE fallback<>''",null
    ).use { c -> buildList { while(c.moveToNext()) add(c.getString(0)) } }

    /** 下行真正改封面才废弃私有代次；同设备空 cover 回声保留本地图。 */
    fun remote(account: String, next: CollectedPlaylist, ownEcho: Boolean, clock: Long): CollectedPlaylist = transaction { db ->
        val edit = read(db,account,next.id) ?: return@transaction next
        val prior = playlist(db,account,next.id) ?: return@transaction next
        val same = next.cover == prior.cover && next.coverResource == prior.coverResource && next.coverPreset == prior.coverPreset
        val localEcho = ownEcho && next.cover.isBlank() && next.coverResource == null && next.coverPreset == null && edit.fallback.isNotBlank() && prior.cover == edit.fallback
        if (same || localEcho) {
            // 下行已通过 pending 守卫，使用真实胜出的整项时钟；不能保留被 LWW 拒绝的更晚本机时间。
            if (clock > 0) update(edit,ContentValues().apply { put("document_clock",clock) })
            if (localEcho) next.copy(cover=prior.cover) else next
        } else {
            db.delete("playlist_cover_edits","account_id=? AND playlist_id=?",arrayOf(account,next.id))
            next
        }
    }

    private fun <T> transaction(action: (SQLiteDatabase)->T): T {
        val db=helper.writableDatabase; db.beginTransaction()
        try { val result=action(db); db.setTransactionSuccessful(); return result } finally { db.endTransaction() }
    }

    companion object {
        private val gson=Gson()
        private fun documentClock(db: SQLiteDatabase, account: String, id: String): Long = db.rawQuery(
            "SELECT updated_at FROM local_playlists WHERE owner_account_id=? AND id=?",arrayOf(account,id)
        ).use { if(it.moveToFirst()) it.getLong(0) else 0L }
        fun recordLocalEdit(db: SQLiteDatabase, account: String, id: String, clock: Long) {
            val current=playlist(db,account,id) ?: return
            val prior=read(db,account,id)
            if(prior != null && prior.expected == current.cover &&
                (current.coverResource == null || current.coverResource.resourceId == prior.resourceId)) {
                db.execSQL("UPDATE playlist_cover_edits SET document_clock=? WHERE account_id=? AND playlist_id=?",arrayOf(clock,account,id))
                return
            }
            val local=MinePlaylistCoverResolver.isLocalFileCover(current.cover)
            db.insertWithOnConflict("playlist_cover_edits",null,ContentValues().apply {
                put("account_id",account);put("playlist_id",id);put("generation",UUID.randomUUID().toString())
                put("expected_cover",current.cover);put("fallback",if(local) current.cover else "")
                put("resource_id",current.coverResource?.resourceId.orEmpty());put("resource_url",if(current.coverResource != null) current.cover else "")
                put("upload_id","");put("state",if(local) "QUEUED" else "NONE");put("attempts",0)
                put("last_error","");put("document_clock",clock)
            },SQLiteDatabase.CONFLICT_REPLACE)
        }
        private fun read(db: SQLiteDatabase, account: String, id: String): Edit? = db.rawQuery(
            "SELECT * FROM playlist_cover_edits WHERE account_id=? AND playlist_id=?",arrayOf(account,id)
        ).use { c ->
            if(!c.moveToFirst()) null else {
                fun s(name:String)=c.getString(c.getColumnIndexOrThrow(name)).orEmpty()
                Edit(account,id,s("generation"),s("expected_cover"),s("fallback"),s("resource_id"),s("resource_url"),s("upload_id"),s("state"),
                    c.getInt(c.getColumnIndexOrThrow("attempts")),s("last_error"),c.getLong(c.getColumnIndexOrThrow("document_clock")))
            }
        }
        private fun playlist(db: SQLiteDatabase, account: String, id: String): CollectedPlaylist? = db.rawQuery(
            "SELECT payload_json,cover,name,intro FROM local_playlists WHERE owner_account_id=? AND id=?",arrayOf(account,id)
        ).use { c ->
            if(!c.moveToFirst()) null else gson.fromJson(c.getString(0),CanonicalPlaylist::class.java).toCollectedPlaylist()
                .copy(cover=c.getString(1),name=c.getString(2),intro=c.getString(3))
        }
        private fun writePlaylist(db: SQLiteDatabase,account:String,next:CollectedPlaylist) {
            check(db.update("local_playlists",ContentValues().apply {
                put("cover",next.cover);put("payload_json",gson.toJson(next.toCanonicalPlaylist()))
            },"owner_account_id=? AND id=?",arrayOf(account,next.id))==1)
        }
    }
}
