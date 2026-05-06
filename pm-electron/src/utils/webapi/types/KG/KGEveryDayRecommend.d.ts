export interface KGEveryDayRecommendResponse {
    data: KGEveryDayRecommendData;
    status: number;
    error_code: number;
}
export interface KGEveryDayRecommendData {
    creation_date: string;
    mid: string;
    bi_biz: string;
    sign: string;
    song_list_size: number;
    OlexpIds: string;
    client_playlist_flag: number;
    is_guarantee_rec: number;
    song_list: KGEveryDayRecommendSong[];
    sub_title: string;
    cover_img_url: string;
}
export interface KGEveryDayRecommendSong {
    filesize_flac: number;
    official_songname: string;
    ori_audio_name: string;
    hash_192: string;
    hash_flac: string;
    songname: string;
    music_trac: number;
    is_original: number;
    pay_type: number;
    song_type: string;
    album_id: string;
    remark: Remark;
    language: Language;
    is_file_head_320: number;
    alg_path: string;
    is_file_head: number;
    filename: string;
    cid: number;
    scid: number;
    suffix_audio_name: SuffixAudioName;
    rec_copy_write?: RecCopyWrite;
    mv_hash: string;
    hash: string;
    author_name: string;
    tags: Tag[];
    rank_label?: string;
    bitrate: number;
    is_mv_file_head: number;
    has_accompany: number;
    filesize_128: number;
    album_name: string;
    ztc_mark: string;
    climax_end_time: number;
    songid: number;
    quality_level: number;
    filesize_192: number;
    publish_date: Date;
    file_size: number;
    has_album: number;
    extname: Extname;
    type: Type;
    tracker_info: TrackerInfo;
    filesize_320: number;
    level: number;
    time_length: number;
    rec_copy_write_id?: string;
    old_cpy: number;
    rec_label_prefix?: string;
    hash_128: string;
    hash_320: string;
    relate_goods: RelateGoods;
    mixsongid: string;
    hash_other: string;
    sizable_cover: string;
    mv_type: number;
    publish_time: number;
    filesize_ape: number;
    rec_label_type?: number;
    singerinfo: Singerinfo[];
    hash_ape: string;
    trans_param: TransParam;
    timelength_320: number;
    album_audio_remark: string;
    album_audio_id: string;
    filesize_other: number;
    ips_tags: IPSTag[];
    privilege: number;
    fail_process: number;
    climax_start_time: number;
    climax_timelength: number;
    is_publish: number;
    rec_sub_copy_write?: string;
    rank_id?: string;
}
declare enum Extname {
    Mp3 = "mp3"
}
interface IPSTag {
    name: string;
    ip_id: string;
    pid: string;
}
declare enum Language {
    国语 = "\u56FD\u8BED",
    粤语 = "\u7CA4\u8BED",
    纯音乐 = "\u7EAF\u97F3\u4E50",
    英语 = "\u82F1\u8BED",
    韩语 = "\u97E9\u8BED"
}
declare enum RecCopyWrite {
    人气歌曲推荐 = "\u4EBA\u6C14\u6B4C\u66F2\u63A8\u8350",
    圈友推荐 = "\u5708\u53CB\u63A8\u8350"
}
interface RelateGoods {
}
declare enum Remark {
    Empty = "",
    LostGravity = "Lost Gravity",
    电吉他 = "\u7535\u5409\u4ED6"
}
interface Singerinfo {
    name: string;
    is_publish: string;
    id: string;
}
declare enum SuffixAudioName {
    Empty = "",
    OriginalMix = "Original Mix",
    手碟空灵版 = "\u624B\u789F\u7A7A\u7075\u7248",
    钢琴版 = "\u94A2\u7434\u7248"
}
interface Tag {
    tag_id: string;
    parent_id: string;
    tag_name: string;
}
interface TrackerInfo {
    auth: string;
    module_id: number;
    open_time: string;
}
interface TransParam {
    cpy_grade: number;
    classmap: Map;
    language: Language;
    cpy_attr0: number;
    musicpack_advance: number;
    ogg_128_filesize: number;
    display_rate: number;
    ogg_320_filesize: number;
    qualitymap: Qualitymap;
    union_cover: string;
    ogg_128_hash: string;
    cid: number;
    ogg_320_hash: string;
    display: number;
    ipmap: Map;
    hash_offset?: HashOffset;
    hash_multitrack: string;
    pay_block_tpl: number;
    cpy_level: number;
    appid_block?: string;
    songname_suffix?: string;
}
interface Map {
    attr0: number;
}
interface HashOffset {
    clip_hash: string;
    start_byte: number;
    end_ms: number;
    end_byte: number;
    file_type: number;
    start_ms: number;
    offset_hash: string;
}
interface Qualitymap {
    attr0: number;
    attr1: number;
}
declare enum Type {
    Audio = "audio"
}
export {};
