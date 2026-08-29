package cn.partialy.pm.network.cloudmusic

data class CloudMusicSelectedFileDto(
    val fileName: String,
    val fileSize: Long,
    val mimeType: String,
)

data class CloudMusicUploadSessionRequest(
    val audio: CloudMusicSelectedFileDto,
    val cover: CloudMusicSelectedFileDto? = null,
    val lyrics: CloudMusicSelectedFileDto? = null,
)

data class CloudMusicAssetReserveRequest(
    val fileName: String,
    val fileSize: Long,
    val mimeType: String,
    val kind: String,
)

data class CloudMusicAssetUploadTicketDto(
    val assetId: String,
    val fileRecordId: String,
    val kind: String,
    val key: String,
    val uploadToken: String,
    val uploadUrl: String,
)

data class CloudMusicUploadSessionDto(
    val uuid: String = "",
    val track: CloudMusicTrackDto,
    val tickets: List<CloudMusicAssetUploadTicketDto> = emptyList(),
)

data class CloudMusicSubmissionInput(
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
)

data class CloudMusicSubmissionHistoryDto(
    val items: List<CloudMusicTrackDto> = emptyList(),
    val total: Int = 0,
    val offset: Int = 0,
    val limit: Int = 30,
)
