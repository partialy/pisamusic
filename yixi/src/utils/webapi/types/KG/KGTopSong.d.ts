export interface KGTopSongResponse {
    total: number;
    error_code: number;
    data: KGTopSongItem[];
    extra: Extra;
    status: number;
    errmsg: string;
}
export interface KGTopSongItem {
    authors: Author[];
    old_hide_flac: number;
    status: number;
    status_128: number;
    filesize_320: number;
    rp_id: number;
    extern: string;
    old_cpy_high: number;
    cd_url: string;
    fail_process: number;
    pay_type: number;
    rp_type: RpType;
    topic_url_flac: string;
    privilege_high: number;
    parent_id: string;
    old_cpy_320: number;
    pkg_price_320: number;
    topic_remark: string;
    pay_type_high: number;
    privilege_128: number;
    price_320: number;
    fail_process_128: number;
    fail_process_320: number;
    rank_id: string;
    zone: string;
    cid: number;
    video_id: number;
    buy_count: string;
    hash: string;
    rp_type_320: RpType;
    price_128: number;
    rp_type_flac: RpType;
    timelength_high: number;
    album_name: string;
    topic_url_128: string;
    issue: string;
    publish_date: Date;
    ad_id: number;
    timelength_super: number;
    old_hide_super: number;
    status_super: number;
    old_hide_128: number;
    pkg_price_super: number;
    price_high: number;
    timelength_128: number;
    price_super: number;
    max_sort: number;
    exclusive: number;
    album_audio_remark: string;
    hash_super: string;
    timelength: number;
    privilege_super: number;
    last_sort: number;
    rp_type_128: RpType;
    filesize_flac: number;
    rank_count: number;
    songname: string;
    old_hide: number;
    pay_type_128: number;
    show_author_name: number;
    video_hash: string;
    recommend_reason: string;
    rank_cid: number;
    video_filesize: number;
    status_320: number;
    pay_type_super: number;
    old_hide_320: number;
    offset: number;
    filename: string;
    __status: number;
    rp_type_high: RpType;
    timelength_flac: number;
    topic_url: string;
    rp_publish: number;
    old_cpy_super: number;
    audio_id: number;
    remark: string;
    musical: Extra;
    pkg_price_high: number;
    filesize_128: number;
    album_id: number;
    hash_320: string;
    pkg_price_flac: number;
    has_obbligato: number;
    topic_url_320: string;
    fail_process_high: number;
    filesize_high: number;
    filesize: number;
    extname_super: string;
    status_high: number;
    video_track: number;
    bitrate_high: number;
    bitrate_super: number;
    hash_high: string;
    price_flac: number;
    author_name: string;
    sort: number;
    timelength_320: number;
    album_sizable_cover: string;
    extname: Extname;
    topic_url_high: string;
    status_flac: number;
    privilege_flac: number;
    old_cpy: number;
    remarks: Remark[];
    old_cpy_128: number;
    topic_url_super: string;
    video_timelength: number;
    filesize_super: number;
    level: number;
    privilege_320: number;
    pkg_price_128: number;
    price: number;
    pay_type_flac: number;
    rp_type_super: string;
    pay_type_320: number;
    bitrate: number;
    trans_param: TransParam;
    hash_flac: string;
    hash_128: string;
    fail_process_super: number;
    fail_process_flac: number;
    old_cpy_flac: number;
    old_hide_high: number;
    album_audio_id: number;
    privilege: number;
    pkg_price: number;
    bitrate_flac: number;
    addtime: Date;
}
interface Author {
    sizable_avatar: string;
    is_publish: number;
    author_id: number;
    author_name: string;
}
declare enum Extname {
    Mp3 = "mp3"
}
interface Extra {
}
interface Remark {
    remark: string;
    ip_type?: number;
    rel_album_audio_id: number;
    remark_type: number;
    work_type?: string;
}
declare enum RpType {
    Audio = "audio",
    Empty = ""
}
interface TransParam {
    init_pub_day?: number;
    pay_block_tpl: number;
    classmap: Map;
    language: Language;
    free_limited?: number;
    cpy_attr0: number;
    musicpack_advance: number;
    display: number;
    display_rate: number;
    qualitymap: Qualitymap;
    cid: number;
    cpy_grade: number;
    union_cover: string;
    ipmap: Map;
    hash_offset?: HashOffset;
    ogg_128_filesize?: number;
    ogg_128_hash?: string;
    cpy_level: number;
    ogg_320_filesize?: number;
    ogg_320_hash?: string;
    appid_block?: string;
    songname_suffix?: string;
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
declare enum Language {
    国语 = "\u56FD\u8BED",
    英语 = "\u82F1\u8BED"
}
interface Qualitymap {
    attr0: number;
    attr1: number;
}
export {};
