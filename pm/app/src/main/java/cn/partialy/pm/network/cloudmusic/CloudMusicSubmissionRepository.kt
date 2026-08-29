package cn.partialy.pm.network.cloudmusic

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.IOException
import java.util.Locale
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import retrofit2.HttpException

@Singleton
class CloudMusicSubmissionRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val systemApiService: SystemApiService,
    private val configManager: ConfigManager,
    @Named("cloud_asset_okhttp") private val cloudAssetClient: OkHttpClient,
) {
    private val contentResolver: ContentResolver = context.contentResolver

    /** 投稿中心只通过 Repository 读取账号状态，避免 UI 层重复理解会话存储。 */
    fun isLoggedIn(): Boolean = currentUserId() != null

    /** 作为投稿状态机的账号隔离键；空白用户 ID 一律视为未登录。 */
    fun currentUserId(): String? = AccountSessionStore.read(context)
        .takeIf { it.loggedIn }
        ?.user
        ?.id
        ?.takeIf { it.isNotBlank() }

    suspend fun resolveFile(
        uri: Uri,
        kind: CloudMusicSubmissionFileKind,
    ): CloudMusicSubmissionFile = withContext(Dispatchers.IO) {
        if (uri.scheme != ContentResolver.SCHEME_CONTENT) {
            throw CloudMusicSubmissionException.InvalidFile("请选择系统文件选择器中的文件")
        }

        val metadata = runCatching { queryFileMetadata(uri) }
            .getOrElse { error ->
                if (error is CloudMusicSubmissionException) throw error
                throw CloudMusicSubmissionException.InvalidFile("无法读取所选文件信息", error)
            }
        val displayName = metadata.first.trim()
        if (displayName.isBlank()) {
            throw CloudMusicSubmissionException.InvalidFile("无法识别所选文件名")
        }

        val extension = displayName.substringAfterLast('.', "")
            .lowercase(Locale.ROOT)
        if (extension !in kind.allowedExtensions) {
            throw CloudMusicSubmissionException.InvalidFile(kind.unsupportedExtensionMessage)
        }

        val size = metadata.second
        if (size <= 0L) {
            throw CloudMusicSubmissionException.InvalidFile("所选文件为空或无法读取文件大小")
        }

        val mimeType = runCatching { contentResolver.getType(uri) }
            .getOrNull()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: extension.defaultMimeType

        CloudMusicSubmissionFile(
            uri = uri,
            displayName = displayName,
            size = size,
            mimeType = mimeType,
            kind = kind,
        )
    }

    suspend fun createAndUploadSubmission(
        audio: CloudMusicSubmissionFile,
        cover: CloudMusicSubmissionFile? = null,
        lyrics: CloudMusicSubmissionFile? = null,
        onProgress: (CloudMusicUploadPhase, Int) -> Unit = { _, _ -> },
    ): CloudMusicTrackDto {
        requireFileKind(audio, CloudMusicSubmissionFileKind.AUDIO)
        cover?.let { requireFileKind(it, CloudMusicSubmissionFileKind.COVER) }
        lyrics?.let { requireFileKind(it, CloudMusicSubmissionFileKind.LYRICS) }

        val session = requestData("创建投稿上传会话失败") {
            systemApiService.createCloudMusicUploadSession(
                authorization(),
                CloudMusicUploadSessionRequest(
                    audio = audio.toSelectedFileDto(),
                    cover = cover?.toSelectedFileDto(),
                    lyrics = lyrics?.toSelectedFileDto(),
                ),
            )
        }.let { it.copy(track = normalizeTrack(it.track)) }
        val uuid = session.track.uuid.ifBlank { session.uuid }
        if (uuid.isBlank()) {
            throw CloudMusicSubmissionException.Api(-1, "投稿上传会话缺少曲目 UUID")
        }

        uploadTicket(
            ticket = session.requireTicket(AUDIO_KIND, "缺少音频上传凭证"),
            file = audio,
        ) { onProgress(CloudMusicUploadPhase.AUDIO, it) }

        cover?.let { file ->
            uploadTicket(
                ticket = session.requireTicket(COVER_KIND, "缺少封面上传凭证"),
                file = file,
            ) { onProgress(CloudMusicUploadPhase.COVER, it) }
            completeAsset(uuid, COVER_KIND)
        }

        lyrics?.let { file ->
            uploadTicket(
                ticket = session.requireTicket(LYRICS_KIND, "缺少歌词上传凭证"),
                file = file,
            ) { onProgress(CloudMusicUploadPhase.LYRICS, it) }
            completeAsset(uuid, LYRICS_KIND)
        }

        onProgress(CloudMusicUploadPhase.PROCESSING, 100)
        return completeAsset(uuid, AUDIO_KIND)
    }

    suspend fun replaceCover(
        uuid: String,
        file: CloudMusicSubmissionFile,
        onProgress: (Int) -> Unit = {},
    ): CloudMusicTrackDto {
        requireFileKind(file, CloudMusicSubmissionFileKind.COVER)
        return replaceAsset(requireUuid(uuid), COVER_KIND, file, onProgress)
    }

    suspend fun replaceLyrics(
        uuid: String,
        file: CloudMusicSubmissionFile,
        onProgress: (Int) -> Unit = {},
    ): CloudMusicTrackDto {
        requireFileKind(file, CloudMusicSubmissionFileKind.LYRICS)
        return replaceAsset(requireUuid(uuid), LYRICS_KIND, file, onProgress)
    }

    suspend fun removeCover(uuid: String): CloudMusicTrackDto =
        requestData("移除投稿封面失败") {
            systemApiService.removeCloudMusicCover(authorization(), requireUuid(uuid))
        }.let(::normalizeTrack)

    suspend fun getHistory(offset: Int = 0, limit: Int = DEFAULT_HISTORY_LIMIT): CloudMusicSubmissionHistoryDto =
        requestData("获取投稿记录失败") {
            systemApiService.getCloudMusicSubmissionHistory(
                authorization = authorization(),
                offset = offset.coerceAtLeast(0),
                limit = limit.coerceIn(1, MAX_PAGE_SIZE),
            )
        }.let { history -> history.copy(items = history.items.map(::normalizeTrack)) }

    suspend fun save(uuid: String, input: CloudMusicSubmissionInput): CloudMusicTrackDto =
        requestData("保存投稿失败") {
            systemApiService.saveCloudMusicSubmission(
                authorization(),
                requireUuid(uuid),
                validateSubmissionInput(input),
            )
        }.let(::normalizeTrack)

    suspend fun resubmit(uuid: String, input: CloudMusicSubmissionInput): CloudMusicTrackDto =
        requestData("重新提交审核失败") {
            systemApiService.resubmitCloudMusicSubmission(
                authorization(),
                requireUuid(uuid),
                validateSubmissionInput(input),
            )
        }.let(::normalizeTrack)

    private fun queryFileMetadata(uri: Uri): Pair<String, Long> {
        var displayName = ""
        var size = -1L
        contentResolver.query(
            uri,
            arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE),
            null,
            null,
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) displayName = cursor.getString(nameIndex).orEmpty()
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
            }
        }
        if (size <= 0L) {
            size = contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
        }
        return displayName to size
    }

    private suspend fun replaceAsset(
        uuid: String,
        kind: String,
        file: CloudMusicSubmissionFile,
        onProgress: (Int) -> Unit,
    ): CloudMusicTrackDto {
        val ticket = requestData("预登记投稿附件失败") {
            systemApiService.reserveCloudMusicAsset(
                authorization = authorization(),
                uuid = uuid,
                kind = kind,
                body = CloudMusicAssetReserveRequest(
                    fileName = file.displayName,
                    fileSize = file.size,
                    mimeType = file.mimeType,
                    kind = kind,
                ),
            )
        }
        uploadTicket(ticket, file, onProgress)
        return completeAsset(uuid, kind)
    }

    private suspend fun completeAsset(uuid: String, kind: String): CloudMusicTrackDto =
        requestData("确认投稿文件失败") {
            systemApiService.completeCloudMusicAsset(authorization(), uuid, kind)
        }.let(::normalizeTrack)

    /** 投稿 DTO 只在内存中补全可展示封面地址，不写回任何业务存储。 */
    private fun normalizeTrack(track: CloudMusicTrackDto): CloudMusicTrackDto {
        val cover = track.cover ?: return track
        val rawUrl = cover.url.trim()
        val absoluteUrl = rawUrl.toHttpUrlOrNull()
        val displayUrl = when {
            absoluteUrl?.isHttps == true -> rawUrl
            else -> configManager.resolveSystemUrl(rawUrl).orEmpty()
        }
        return if (displayUrl == cover.url) track else track.copy(cover = cover.copy(url = displayUrl))
    }

    private suspend fun uploadTicket(
        ticket: CloudMusicAssetUploadTicketDto,
        file: CloudMusicSubmissionFile,
        onProgress: (Int) -> Unit,
    ) {
        val uploadUrl = ticket.uploadUrl.toHttpUrlOrNull()
            ?.takeIf { it.isHttps }
            ?: throw CloudMusicSubmissionException.Upload("七牛上传地址必须为 HTTPS")
        val callReference = AtomicReference<Call?>()
        lateinit var requestBody: CloudMusicUploadRequestBody
        requestBody = CloudMusicUploadRequestBody(
            contentResolver = contentResolver,
            uri = file.uri,
            size = file.size,
            mediaType = file.mimeType.toMediaTypeOrNull(),
            isCallCanceled = { callReference.get()?.isCanceled() == true },
            onProgress = onProgress,
        )
        val multipartBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("token", ticket.uploadToken)
            .addFormDataPart("key", ticket.key)
            .addFormDataPart("x:name", file.displayName)
            .addFormDataPart("file", file.displayName, requestBody)
            .build()
        val request = Request.Builder()
            .url(uploadUrl)
            .post(multipartBody)
            .build()

        suspendCancellableCoroutine<Unit> { continuation ->
            val call = cloudAssetClient.newCall(request)
            callReference.set(call)
            continuation.invokeOnCancellation {
                requestBody.cancel()
                call.cancel()
            }
            call.enqueue(
                object : Callback {
                    override fun onFailure(call: Call, error: IOException) {
                        if (continuation.isActive) {
                            continuation.resumeWithException(
                                CloudMusicSubmissionException.Upload(
                                    if (call.isCanceled()) "七牛直传已取消" else "七牛直传网络异常",
                                    error,
                                ),
                            )
                        }
                    }

                    override fun onResponse(call: Call, response: Response) {
                        response.use {
                            if (!continuation.isActive) return
                            if (!response.isSuccessful) {
                                val responseText = runCatching { response.body?.string().orEmpty() }.getOrDefault("")
                                val qiniuMessage = runCatching { JSONObject(responseText).optString("error") }
                                    .getOrDefault("")
                                    .trim()
                                continuation.resumeWithException(
                                    CloudMusicSubmissionException.Upload(
                                        qiniuMessage.ifBlank { "七牛上传失败：HTTP ${response.code}" },
                                    ),
                                )
                                return
                            }
                            continuation.resume(Unit)
                        }
                    }
                },
            )
        }
    }

    private fun authorization(): String {
        val session = AccountSessionStore.read(context)
        if (!session.loggedIn || session.token.isBlank()) {
            throw CloudMusicSubmissionException.LoginRequired()
        }
        return "Bearer ${session.token}"
    }

    private suspend fun <T> requestData(
        fallback: String,
        block: suspend () -> CloudMusicEnvelope<T>,
    ): T {
        val envelope = try {
            block()
        } catch (error: HttpException) {
            val httpError = parseHttpErrorEnvelope(error)
            throw CloudMusicSubmissionException.Api(
                code = httpError.code ?: error.code(),
                message = httpError.msg ?: fallback,
                cause = error,
            )
        } catch (error: IOException) {
            throw CloudMusicSubmissionException.Network(fallback, error)
        }
        if (!envelope.success || envelope.code != 0) {
            throw CloudMusicSubmissionException.Api(
                code = envelope.code,
                message = envelope.msg.ifBlank { fallback },
            )
        }
        return envelope.data
            ?: throw CloudMusicSubmissionException.Api(envelope.code, envelope.msg.ifBlank { fallback })
    }

    /** Retrofit errorBody 只能消费一次；读取和 JSON 解析失败都安全回退到调用点文案。 */
    private fun parseHttpErrorEnvelope(error: HttpException): HttpErrorEnvelope {
        val body = runCatching {
            error.response()?.errorBody()?.string().orEmpty()
        }.getOrDefault("")
        val json = runCatching { JSONObject(body) }.getOrNull()
            ?: return HttpErrorEnvelope()
        val code = when (val rawCode = json.opt("code")) {
            is Number -> rawCode.toInt()
            is String -> rawCode.toIntOrNull()
            else -> null
        }
        val msg = (json.opt("msg") as? String)
            ?.takeIf { it.isNotBlank() }
        return HttpErrorEnvelope(code = code, msg = msg)
    }

    private fun validateSubmissionInput(input: CloudMusicSubmissionInput): CloudMusicSubmissionInput {
        val title = input.title.trim()
        val artist = input.artist.trim()
        val album = input.album.trim()
        if (title.length !in 1..200) {
            throw CloudMusicSubmissionException.InvalidInput("歌名长度需为 1..200 个字符")
        }
        if (artist.length !in 1..300) {
            throw CloudMusicSubmissionException.InvalidInput("歌手长度需为 1..300 个字符")
        }
        if (album.length > 200) {
            throw CloudMusicSubmissionException.InvalidInput("专辑长度不能超过 200 个字符")
        }
        if (input.durationMs !in 1L..MAX_DURATION_MS) {
            throw CloudMusicSubmissionException.InvalidInput("时长需为 1..86,400,000 毫秒")
        }
        return input.copy(title = title, artist = artist, album = album)
    }

    private fun requireUuid(uuid: String): String = uuid.trim().ifBlank {
        throw CloudMusicSubmissionException.InvalidInput("投稿曲目 UUID 不能为空")
    }

    private fun requireFileKind(file: CloudMusicSubmissionFile, expected: CloudMusicSubmissionFileKind) {
        if (file.kind != expected) {
            throw CloudMusicSubmissionException.InvalidFile("所选文件类型与当前操作不匹配")
        }
    }

    private fun CloudMusicSubmissionFile.toSelectedFileDto() = CloudMusicSelectedFileDto(
        fileName = displayName,
        fileSize = size,
        mimeType = mimeType,
    )

    private fun CloudMusicUploadSessionDto.requireTicket(kind: String, message: String): CloudMusicAssetUploadTicketDto =
        tickets.firstOrNull { it.kind == kind }
            ?: throw CloudMusicSubmissionException.Api(-1, message)

    private val CloudMusicSubmissionFileKind.allowedExtensions: Set<String>
        get() = when (this) {
            CloudMusicSubmissionFileKind.AUDIO -> AUDIO_EXTENSIONS
            CloudMusicSubmissionFileKind.COVER -> COVER_EXTENSIONS
            CloudMusicSubmissionFileKind.LYRICS -> LYRICS_EXTENSIONS
        }

    private val CloudMusicSubmissionFileKind.unsupportedExtensionMessage: String
        get() = when (this) {
            CloudMusicSubmissionFileKind.AUDIO -> "音频仅支持 MP3、FLAC、WAV、OGG、M4A、AAC"
            CloudMusicSubmissionFileKind.COVER -> "封面仅支持 JPG、JPEG、PNG、WEBP"
            CloudMusicSubmissionFileKind.LYRICS -> "歌词仅支持 LRC、TXT"
        }

    private val String.defaultMimeType: String
        get() = when (this) {
            "mp3" -> "audio/mpeg"
            "flac" -> "audio/flac"
            "wav" -> "audio/wav"
            "ogg" -> "audio/ogg"
            "m4a" -> "audio/mp4"
            "aac" -> "audio/aac"
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "webp" -> "image/webp"
            else -> "text/plain"
        }

    private companion object {
        const val AUDIO_KIND = "audio"
        const val COVER_KIND = "cover-uploaded"
        const val LYRICS_KIND = "lyrics"
        const val DEFAULT_HISTORY_LIMIT = 30
        const val MAX_PAGE_SIZE = 100
        const val MAX_DURATION_MS = 86_400_000L
        val AUDIO_EXTENSIONS = setOf("mp3", "flac", "wav", "ogg", "m4a", "aac")
        val COVER_EXTENSIONS = setOf("jpg", "jpeg", "png", "webp")
        val LYRICS_EXTENSIONS = setOf("lrc", "txt")
    }
}

private data class HttpErrorEnvelope(
    val code: Int? = null,
    val msg: String? = null,
)

enum class CloudMusicUploadPhase {
    AUDIO,
    COVER,
    LYRICS,
    PROCESSING,
}

sealed class CloudMusicSubmissionException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause) {
    class LoginRequired : CloudMusicSubmissionException("请先登录 PisaMusic 账号")

    class InvalidFile(message: String, cause: Throwable? = null) :
        CloudMusicSubmissionException(message, cause)

    class InvalidInput(message: String) : CloudMusicSubmissionException(message)

    class Api(val code: Int, message: String, cause: Throwable? = null) :
        CloudMusicSubmissionException(message, cause)

    class Network(message: String, cause: Throwable) : CloudMusicSubmissionException(message, cause)

    class Upload(message: String, cause: Throwable? = null) :
        CloudMusicSubmissionException(message, cause)
}
