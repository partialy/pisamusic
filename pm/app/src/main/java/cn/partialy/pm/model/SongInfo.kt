package cn.partialy.pm.model

/**
 * 歌曲信息数据类
 */
data class SongInfo(
    val id: String,
    val type: SongType,
    val name: String,
    val artist: String,
    var coverUrl: String,
    /** 内嵌封面（本地/已下载列表）；非空时列表优先用字节加载，避免 data URI。 */
    var embeddedCoverArt: ByteArray? = null,
    var album: String? = null,
    var lyric: String? = null,
    var duration: Int? = null,
    /** 服务端是否允许播放；旧调用方和旧快照默认可播放。 */
    val playable: Boolean = true,
)

/** 音源：酷狗 / 网易 / 酷我 / 网盘 / 本地 */
enum class SongType {
    KG,
    WY,
    KW,
    CLOUD,
    LOCAL,
    ;

    companion object
}
