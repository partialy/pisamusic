export interface KGPlaylistResponse {
    data: KGPlaylistData;
    status: number;
    error_code: number;
}
export interface KGPlaylistData {
    begin_idx: number;
    pagesize: number;
    count: number;
    popularization?: any;
    userid: number;
    info: Array<KGPlaylistSongs>;
    list_info: List_info;
}
export interface KGPlaylistSongs {
    mvdata: Array<Mvdata>;
    hash: string;
    brief?: any;
    audio_id: number;
    mvtype: number;
    size: number;
    publish_date: Date;
    name: string;
    mvtrack: number;
    bpm_type: string;
    add_mixsongid: number;
    album_id: string;
    bpm: number;
    mvhash: string;
    extname: string;
    language: string;
    collecttime: number;
    csong: number;
    remark: string;
    level: number;
    tagmap: Tagmap;
    media_old_cpy: number;
    relate_goods: Array<Relate_goods>;
    download: Array<Download>;
    rcflag: number;
    feetype: number;
    has_obbligato: number;
    timelen: number;
    sort: number;
    trans_param: Trans_param;
    medistype: string;
    user_id: number;
    albuminfo: Albuminfo;
    bitrate: number;
    audio_group_id: string;
    privilege: number;
    cover: string;
    mixsongid: number;
    fileid: number;
    heat: number;
    singerinfo: Array<Singerinfo>;
}
interface List_info {
    abtags?: Array<any>;
    tags?: any;
    status: number;
    create_user_pic: string;
    is_pri: number;
    pub_new: number;
    is_drop: number;
    list_create_userid: number;
    is_publish: number;
    musiclib_tags?: Array<any>;
    pub_type: number;
    is_featured: number;
    publish_date: Date;
    collect_total: number;
    list_ver: number;
    intro?: any;
    type: number;
    list_create_listid: number;
    radio_id: number;
    source: number;
    code: number;
    is_def: number;
    parent_global_collection_id: string;
    sound_quality?: any;
    per_count: number;
    plist?: Array<any>;
    create_time: number;
    is_per: number;
    is_edit: number;
    update_time: number;
    per_num: number;
    count: number;
    sort: number;
    is_mine: number;
    listid: number;
    musiclib_id: number;
    kq_talent: number;
    create_user_gender: number;
    pic: string;
    list_create_username: string;
    name: string;
    is_custom_pic: number;
    global_collection_id: string;
    heat: number;
    list_create_gid: string;
}
interface Mvdata {
    typ: number;
}
interface Tagmap {
    genre0: number;
}
interface Relate_goods {
    size: number;
    hash: string;
    level: number;
    privilege: number;
    bitrate: number;
}
interface Download {
    status: number;
    hash: string;
    fail_process: number;
    pay_type: number;
}
interface Trans_param {
    ogg_128_hash: string;
    union_cover: string;
    language: string;
    cpy_attr0: number;
    musicpack_advance: number;
    display: number;
    display_rate: number;
    ogg_320_filesize: number;
    cpy_grade: number;
    qualitymap: Qualitymap;
    hash_multitrack: string;
    songname_suffix: string;
    cid: number;
    ogg_128_filesize: number;
    classmap: Classmap;
    ogg_320_hash: string;
    hash_offset: Hash_offset;
    pay_block_tpl: number;
    ipmap: Ipmap;
    cpy_level: number;
}
interface Albuminfo {
    name: string;
    id: number;
    publish: number;
}
interface Singerinfo {
    id: number;
    publish: number;
    name: string;
    avatar: string;
    type: number;
}
interface Qualitymap {
    attr0: number;
    attr1: number;
}
interface Classmap {
    attr0: number;
}
interface Hash_offset {
    clip_hash: string;
    start_byte: number;
    file_type: number;
    end_byte: number;
    end_ms: number;
    start_ms: number;
    offset_hash: string;
}
interface Ipmap {
    attr0: number;
}
export {};
