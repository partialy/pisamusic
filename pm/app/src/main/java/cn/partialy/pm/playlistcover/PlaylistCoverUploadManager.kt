package cn.partialy.pm.playlistcover

import android.content.Context
import android.content.ContentValues
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.sync.SyncPayloads
import cn.partialy.pm.sync.PendingSyncOp
import cn.partialy.pm.sync.SyncWorkRunner
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.ui.playlistedit.PlaylistEditCoverFiles
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class PlaylistCoverUploadManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SystemApiService,
    @Named("cloud_asset_okhttp") private val uploadClient: OkHttpClient,
    private val playlists: PlaylistCollectionManager,
) {
    private val store=PlaylistCoverStore(context)

    suspend fun drain(account: String): Boolean {
        val sessionGeneration=AccountSessionStore.libraryGeneration
        fun current()=AccountSessionStore.read(context).let { it.loggedIn && it.user.id == account &&
            sessionGeneration == AccountSessionStore.libraryGeneration }
        synchronized(AccountSessionStore.libraryBoundary) { if(current()) store.initialize(account) }
        var retry=false
        for(edit in store.pending(account).take(20)) {
            if(!current()) break
            try {
                val authorization="Bearer ${AccountSessionStore.read(context).token}"
                fun requireCurrent() {
                    check(current() && store.get(account,edit.playlist)?.generation == edit.generation) { "封面编辑已变化" }
                }
                requireCurrent()
                var ready=edit.state == "READY"
                if(ready) {
                    val resource=api.queryCover(authorization,edit.resourceId).requireData()
                    validate(resource,edit)
                } else {
                    if(edit.uploadId.isNotBlank()) {
                        try {
                            val resource=api.completeCover(authorization,CoverCompleteRequest(edit.uploadId,edit.generation)).requireData()
                            validate(resource,edit)
                            synchronized(AccountSessionStore.libraryBoundary) { requireCurrent(); store.saveReady(edit,resource) }
                            ready=true
                        } catch(e: HttpException) {
                            // 没有确认上传完成时，进程可能死在 token/直传之间；新建会话安全恢复，旧对象由 Server 延迟回收。
                            if(e.code()!=400 && !(edit.state=="QUEUED" && e.code()>=500)) throw e
                        }
                    }
                    if(!ready) {
                        val source=MinePlaylistCoverResolver.localFileForCover(edit.fallback) ?: error("本机封面已不可读，请重新选择或恢复默认")
                        val owned=java.io.File(context.filesDir,"playlist_covers").canonicalFile
                        check(source.canonicalFile.parentFile == owned) { "封面不属于应用私有目录" }
                        val files=PlaylistEditCoverFiles(context)
                        val normalized=files.normalize(android.net.Uri.fromFile(source))
                        try {
                            val file=checkNotNull(MinePlaylistCoverResolver.localFileForCover(normalized))
                            requireCurrent()
                            val ticket=api.coverUploadToken(authorization,CoverTokenRequest(edit.playlist,edit.generation,
                                file.name,file.length(),"image/jpeg")).requireData()
                            check(ticket.userId == account && ticket.playlistId == edit.playlist && ticket.editGeneration == edit.generation &&
                                ticket.uploadId.isNotBlank() && ticket.key.isNotBlank() && ticket.provider == "qiniu") { "封面上传归属不符" }
                            synchronized(AccountSessionStore.libraryBoundary) {
                                requireCurrent(); check(store.update(edit,ContentValues().apply { put("upload_id",ticket.uploadId) }))
                            }
                            upload(ticket,file)
                            synchronized(AccountSessionStore.libraryBoundary) {
                                requireCurrent(); check(store.update(edit,ContentValues().apply { put("state","UPLOADED") }))
                            }
                            requireCurrent()
                            val resource=api.completeCover(authorization,CoverCompleteRequest(ticket.uploadId,edit.generation)).requireData()
                            validate(resource,edit,ticket.uploadId)
                            synchronized(AccountSessionStore.libraryBoundary) { requireCurrent(); check(store.saveReady(edit,resource)) }
                        } finally { files.deleteTemporary(normalized) }
                    }
                }
                synchronized(AccountSessionStore.libraryBoundary) {
                    requireCurrent()
                    if(store.link(edit)) playlists.reload()
                }
                SyncWorkRunner.request(context)
            } catch(e: CancellationException) { throw e }
            catch(e: Exception) {
                synchronized(AccountSessionStore.libraryBoundary) {
                    if(current() && store.get(account,edit.playlist)?.generation == edit.generation) {
                        val http=(e as? HttpException)?.code()
                        val permanent=http == 400 || (e !is IOException && e !is HttpException)
                        store.failure(edit,if(http==401) "请重新登录后重试封面上传" else "封面上传失败，可手动重试或恢复默认",permanent)
                        retry=retry || (!permanent && edit.attempts+1 < 5)
                    }
                }
            }
        }
        return retry || (current() && store.pending(account).isNotEmpty())
    }

    private fun validate(resource: CoverResource, edit: PlaylistCoverStore.Edit, uploadId: String = edit.uploadId) {
        check(resource.userId==edit.account && resource.playlistId==edit.playlist && resource.editGeneration==edit.generation &&
            resource.resourceId.isNotBlank() && resource.url.toHttpUrlOrNull()?.isHttps==true && resource.width in 1..8192 && resource.height in 1..8192) { "封面资源归属或格式不符" }
        if(uploadId.isNotBlank()) check(resource.uploadId==uploadId) { "封面会话不符" }
    }

    private suspend fun upload(ticket: CoverToken,file: java.io.File) {
        val url=ticket.uploadUrl.toHttpUrlOrNull()?.takeIf { it.isHttps } ?: error("上传地址必须为 HTTPS")
        val body=MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("token",ticket.uploadToken).addFormDataPart("key",ticket.key)
            .addFormDataPart("file",file.name,file.asRequestBody("image/jpeg".toMediaType())).build()
        suspendCancellableCoroutine<Unit> { continuation ->
            val call=uploadClient.newCall(Request.Builder().url(url).post(body).build())
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object: Callback {
                override fun onFailure(call: Call,e: IOException) { if(continuation.isActive) continuation.resumeWithException(e) }
                override fun onResponse(call: Call,response: Response) {
                    response.use { if(continuation.isActive) {
                        if(it.isSuccessful) continuation.resume(Unit)
                        else continuation.resumeWithException(IOException("封面文件上传失败"))
                    } }
                }
            })
        }
    }

    /** 同步整批 400 只处理经 query 明确证实失效的资源；其他错误继续保留 pending。 */
    suspend fun recoverRejectedResources(account: String, pending: List<PendingSyncOp>): Boolean {
        val generation=AccountSessionStore.libraryGeneration
        val session=AccountSessionStore.read(context)
        if(!session.loggedIn || session.user.id != account) return false
        var recovered=false
        for(op in pending.filter { it.itemType==SyncPayloads.TYPE_USER_PLAYLIST && it.action==SyncPayloads.ACTION_UPSERT }) {
            val parsed=SyncPayloads.parsePlaylist(SyncPayloads.parseJsonObject(op.payloadJson),op.itemKey) ?: continue
            val id=parsed.coverResource?.resourceId ?: continue
            try { api.queryCover("Bearer ${session.token}",id).requireData() }
            catch(e: HttpException) {
                if(e.code()!=400) continue
                synchronized(AccountSessionStore.libraryBoundary) {
                    if(AccountSessionStore.libraryGeneration==generation && AccountSessionStore.read(context).user.id==account) {
                        recovered=store.invalidate(account,parsed.id,id) || recovered
                        if(recovered) playlists.reload()
                    }
                }
            }
        }
        return recovered
    }
}
