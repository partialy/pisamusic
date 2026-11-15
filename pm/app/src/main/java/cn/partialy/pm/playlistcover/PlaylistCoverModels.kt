package cn.partialy.pm.playlistcover

data class CoverEnvelope<T>(val code: Int, val msg: String = "", val success: Boolean = true, val data: T?) {
    fun requireData(): T { check(success && code == 0) { msg.ifBlank { "封面服务失败" } }; return checkNotNull(data) }
}
data class CoverTokenRequest(val playlistId: String, val editGeneration: String,
    val fileName: String, val fileSize: Long, val mimeType: String)
data class CoverCompleteRequest(val uploadId: String, val editGeneration: String)
data class CoverToken(val provider: String, val uploadToken: String, val uploadUrl: String,
    val key: String, val uploadId: String, val userId: String, val playlistId: String, val editGeneration: String)
data class CoverResource(val resourceId: String, val userId: String, val playlistId: String,
    val uploadId: String, val editGeneration: String, val url: String, val width: Int, val height: Int)
