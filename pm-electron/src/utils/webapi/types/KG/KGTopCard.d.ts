export interface KGTopCardResponse {
    data: KGTopCardData;
    status: number;
    error_code: number;
}
export interface KGTopCardData {
    OlexpIds: string;
    song_list: KGTopCardSong[];
    song_list_size: number;
    bi_biz: string;
    rec_desc: string;
    rec_user_nickname: string;
    sign: string;
    card_id: number;
}
export interface KGTopCardSong {
    filesize_flac: number;
    official_songname: string;
    ori_audio_name: string;
    hash_192: string;
    is_rec: number;
    hash_flac: string;
    songname: string;
    music_trac: number;
    is_original: number;
    pay_type: number;
    song_type: number;
    album_id: number;
    remark: string;
    language: string;
    is_file_head_320: number;
    alg_path: string;
    is_file_head: number;
    timelength_320: number;
    scid: number;
    suffix_audio_name: string;
    mv_hash: string;
    hash: string;
    author_name: string;
    tags: Tag[];
    rank_label?: string;
    bitrate: number;
    is_mv_file_head: number;
    has_accompany: number;
    filesize_128: number;
    hash_320: string;
    ztc_mark: string;
    rec_source_type: string;
    report_info: string;
    filesize_192: number;
    publish_date: Date;
    file_size: number;
    has_album: number;
    extname: Extname;
    type: Type;
    level: number;
    from: number;
    old_cpy: number;
    hash_128: string;
    tracker_info: TrackerInfo;
    ips_tags: IPSTag[];
    relate_goods: RelateGoods;
    filesize_other: number;
    sizable_cover: string;
    singerinfo: Singerinfo[];
    mv_type: number;
    publish_time: number;
    filesize_ape: number;
    rec_label_type?: number;
    album_name: string;
    filesize_320: number;
    trans_param: TransParam;
    filename: string;
    album_audio_remark: string;
    album_audio_id: string;
    hash_ape: string;
    hash_other: string;
    privilege: number;
    time_length: number;
    mixsongid: string;
    fail_process: number;
    quality_level: number;
    songid: number;
    rec_label_prefix?: string;
    rank_id?: number;
}
declare enum Extname {
    Mp3 = "mp3"
}
interface IPSTag {
    name: string;
    ip_id: string;
    pid: string;
}
interface RelateGoods {
}
interface Singerinfo {
    name: string;
    is_publish: number;
    id: number;
}
interface Tag {
    tag_id: number;
    parent_id: number;
    tag_name: string;
}
interface TrackerInfo {
    auth: string;
    module_id: number;
    open_time: string;
}
interface TransParam {
    ogg_128_hash: string;
    classmap: Map;
    language: string;
    cpy_attr0: number;
    musicpack_advance: number;
    display: number;
    display_rate: number;
    ogg_320_filesize: number;
    ipmap: Map;
    qualitymap: Qualitymap;
    hash_multitrack?: string;
    ogg_320_hash: string;
    cid: number;
    union_cover: string;
    ogg_128_filesize: number;
    songname_suffix?: string;
    hash_offset?: HashOffset;
    pay_block_tpl: number;
    cpy_grade?: number;
    cpy_level?: number;
    appid_block?: string;
    free_for_ad?: number;
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
