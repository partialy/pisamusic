/**
 * 搜索请求参数接口
 * @property {string} keywords - 必选参数，搜索关键词
 * @property {number} [page] - 可选参数，页码
 * @property {number} [pagesize] - 可选参数，每页数量，默认为30
 * @property {SearchType} [type] - 可选参数，搜索类型，默认为'song'（单曲）
 */
export interface KGSearchParams {
    /**
     * 必选参数，搜索关键词
     * @example '周杰伦'
     */
    keywords: string;
    /**
     * 可选参数，页码
     * @default 1 - 默认第一页
     */
    page?: number;
    /**
     * 可选参数，每页数量
     * @default 30 - 默认每页30条结果
     */
    pagesize?: number;
    /**
     * 可选参数，搜索类型
     * @default 'song' - 默认搜索单曲
     */
    type?: SearchType;
}
/**
 * 支持的搜索类型
 */
type SearchType = 
/** 歌单 */
'special'
/** 歌词 */
 | 'lyric'
/** 单曲（默认） */
 | 'song'
/** 专辑 */
 | 'album'
/** 歌手 */
 | 'author'
/** MV */
 | 'mv';
/**
 * 音乐 URL 请求参数接口
 * @property {string} hash - 必选参数，音乐的唯一标识 hash
 * @property {MusicQuality} [quality] - 可选参数，指定音质类型
 */
export interface KGUrlParams {
    /**
     * 必选参数，音乐的唯一标识 hash
     * @example 'A1B2C3D4E5F6G7H8I9J0'
     */
    hash: string;
    /**
     * 可选参数，指定音质类型
     * @default '128' - 默认返回 128kbps MP3 格式
     */
    quality?: MusicQuality;
}
/**
 * 支持的音质类型
 * @description 部分音质仅对特定音乐有效
 */
type MusicQuality = 
/** 魔法音乐 - 钢琴音效（仅部分音乐支持） */
'piano'
/**
 * 魔法音乐 - 人声/伴奏分离（仅部分音乐支持）
 * @note 返回 MKV 格式，包含人声和伴奏双音轨
 */
 | 'acappella'
/** 魔法音乐 - 骨笛音效（仅部分音乐支持） */
 | 'subwoofer'
/** 魔法音乐 - 尤克里里音效（仅部分音乐支持） */
 | 'ancient'
/** 魔法音乐 - 唢呐音效（仅部分音乐支持） */
 | 'surnay'
/** 魔法音乐 - DJ混音（仅部分音乐支持） */
 | 'dj'
/** 标准音质 - 128kbps MP3 */
 | '128'
/** 高品质 - 320kbps MP3 */
 | '320'
/** 无损音质 - FLAC 格式 */
 | 'flac'
/** 无损音质 - 高解析度音频 */
 | 'high'
/** 蝰蛇音效 - 全景声（仅部分音乐支持） */
 | 'viper_atmos'
/** 蝰蛇音效 - 超清音质 */
 | 'viper_clear'
/**
 * 蝰蛇音效 - 母带音质（仅部分音乐支持）
 * @warning 需要转码处理，当前未实现相关技术
 */
 | 'viper_tape';
/**
* 获取歌单所有歌曲请求参数接口
* @description 通过歌单 global_collection_id 获取全部歌曲
* @endpoint /playlist/track/all
*/
export interface PlaylistTrackParams {
    /**
     * 必选参数，歌单全局唯一标识
     * @example 'collection_3_1863870844_4_0'
     * @pattern ^collection_\d+_\d+_\d+_\d+$ 歌单ID格式示例
     */
    id: string;
    /**
     * 可选参数，当前页码
     * @minimum 1 最小值为1
     * @default 1 默认第一页
     */
    page?: number;
    /**
     * 可选参数，每页数量
     * @minimum 1 最小值为1
     * @maximum 100 最大不超过100
     * @default 30 默认每页30条
     */
    pagesize?: number;
}
export interface KGLyricParams {
    /**
     * 必选参数，歌词唯一标识
     */
    id: string;
    /**
     * 必选参数，access_key
     */
    accesskey: string;
    /**
     * 可选参数，歌词格式lrc | krc
     */
    fmt?: 'lrc' | 'krc';
    /**
     * 可选参数，是否解码
     */
    decode?: boolean;
}
export {};
