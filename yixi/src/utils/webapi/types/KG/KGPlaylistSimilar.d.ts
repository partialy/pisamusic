export interface KGPlaylistSimilarResponse {
    error_code: number;
    data: KGPlaylistSimilar[];
    status: number;
}
export interface KGPlaylistSimilar {
    collection_list: KGPlaylistSimilarCollection[];
    tag_info: TagInfo[];
}
export interface KGPlaylistSimilarCollection {
    flexible_cover: string;
    user_name: string;
    is_recommend: string;
    user_is_verified: string;
    collection_name: string;
    heat: string;
    sync: string;
    ugc_talent_info: UgcTalentInfo;
    is_publish: string;
    special_tag: string;
    songs?: Song[];
    trans_param: CollectionListTransParam;
    user_avatar?: string;
    user_id: string;
    song_count?: number;
    percount: string;
    publish_date: Date;
    collection_id: string;
    cover: string;
    cloudlist_id: string;
    global_collection_id: string;
    intro: string;
    type: string;
}
interface Song {
    sort: number;
    level: number;
    hash: string;
    cover: string;
    trans_param: SongTransParam;
    name: string;
    mixsongid: number;
    privilege: number;
}
interface SongTransParam {
    cpy_grade?: number;
    classmap: Map;
    language: Language;
    cpy_attr0: number;
    musicpack_advance: number;
    display: number;
    display_rate: number;
    cpy_level?: number;
    qualitymap: Qualitymap;
    pay_block_tpl: number;
    hash_multitrack?: string;
    cid: number;
    ogg_128_hash?: string;
    ogg_128_filesize?: number;
    ipmap?: Map;
    hash_offset?: HashOffset;
    ogg_320_hash?: string;
    union_cover?: string;
    ogg_320_filesize?: number;
    songname_suffix?: string;
    appid_block?: string;
    free_limited?: number;
    free_for_ad?: number;
    is_super_vip?: number;
    audio_privilege?: number;
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
    粤语 = "\u7CA4\u8BED",
    英语 = "\u82F1\u8BED",
    西班牙语 = "\u897F\u73ED\u7259\u8BED",
    韩语 = "\u97E9\u8BED"
}
interface Qualitymap {
    attr0: number;
    attr1: number;
}
interface CollectionListTransParam {
    special_tag: string;
}
interface UgcTalentInfo {
    review_status?: string;
}
interface TagInfo {
    tag_name: string;
    tag_id: string;
}
export {};
