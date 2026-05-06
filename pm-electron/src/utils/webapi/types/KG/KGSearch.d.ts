import { KGSearchSong } from "./KGSearchSong";
export interface KGSearchResponse {
    status: number;
    error_code: number;
    error_msg: string;
    data: KGSearchData;
}
export interface KGSearchData {
    pagesize: number;
    page: number;
    from: number;
    size: number;
    total: number;
    correctiontype: number;
    correctionforce: number;
    correctiontip: string;
    theme: {
        valid: boolean;
    };
    lists: KGSearchSong[] | KGSearchListItem[] | KGSearchMVItem[] | KGSearchAlbumItem[] | KGSearchAuthorItem[] | KGSearchLyricItem[];
}
export interface KGSearchListItem {
    grade: number;
    quality: number;
    quality_new: number;
    version: number;
    high_quality: number;
    isugc: number;
    ispublish: number;
    isvip: number;
    isperiodical: number;
    nper: number;
    iscustom: number;
    specialid: number;
    song_count: number;
    specialname: string;
    contain: string;
    img: string;
    intro: string;
    grade_int: string;
    grade_float: string;
    publish_time: string;
    collect_count: string;
    suid: string;
    nickname: string;
    srid: string;
    play_count: string;
    total_play_count: string;
    gid: string;
    alg_path: string;
    tag_str: string;
    abtags: any[];
    trans_param: {
        special_tag: number;
        trans_flag: number;
    };
}
export interface KGSearchMVItem {
    MvID: number;
    AudioID: string;
    FileName: string;
    SingerName: string;
    MvName: string;
    Auxiliary: string;
    OstAuxiliary: string;
    AlbumAux: string;
    Remark: string;
    IpRemark: string;
    Description: string;
    MvHot: number;
    PublishAge: number;
    MvHash: string;
    MvTrac: number;
    MvType: number;
    FileHash: string;
    FileSize: number;
    ExtName: string;
    Duration: number;
    Bitrate: number;
    AudioCdn: number;
    Privilege: number;
    MixSongID: string;
    PublishDate: string;
    Pic: string;
    ErectPic: string;
    IsNew: number;
    Scid: number;
    MvHashMark: string;
    IsOfficial: number;
    Isshort: number;
    Username: string;
    Userid: number;
    HistoryHeat: number;
    IsUgc: number;
    ThumbGif: string;
    ThumbMp4: string;
    goods_info: {
        pay_type: number;
    };
    AlgPath: string;
    SingerID: number[];
    AlbumID: string;
    Singers: {
        name: string;
        id: number;
    }[];
}
export interface KGSearchAlbumItem {
    albumid: number;
    albumname: string;
    singer: string;
    singerid: string;
    grade: number;
    grade_int: string;
    img: string;
    intro: string;
    grade_float: string;
    company: string;
    quality: number;
    title: string;
    collect_count: number;
    publish_time: string;
    language: string;
    privilege: number;
    oldhide: number;
    buyercount: number;
    songcount: number;
    newquality: number;
    cd_url: string;
    isfirst: number;
    category: number;
    short_intro: string;
    ostremark: string;
    auxiliary: string;
    play_times: number;
    program_inner: number;
    alg_path: string;
    program_def_songs: any[];
    tag_str: string;
    album_aux: string;
    play_count: number;
    isouter: number;
    outerdata: {};
    trans_param: {
        special_tag: string;
    };
    singerids: number[];
    singers: {
        name: string;
        id: number;
    }[];
    rec_tag: {
        desc: string;
        type: number;
    };
    jump_url: string;
}
export interface KGSearchAuthorItem {
    AuthorId: number;
    AuthorName: string;
    IsSettledAuthor: number;
    Avatar: string;
    Heat: number;
    Auxiliary: string;
    AlbumCount: number;
    AudioCount: number;
    VideoCount: number;
    LyricistCount: number;
    ComposerCount: number;
    Identity: number;
    ComplexSongName: string;
    FansNum: number;
    UserId: number;
    AuthorStatus: number;
    AlgPath: string;
}
export interface KGSearchLyricItem {
    TimeLength: number;
    OwnerCount: number;
    Lyric: string;
    ExtName: string;
    BitRate: number;
    Quality: number;
    FileSize: number;
    FileName: string;
    SingerName: string;
    SingerID: number[];
    SongName: string;
    FileHash: string;
    LyricID: number;
    M4asize: number;
    MvHash: string;
    MVType: number;
    MVTrac: number;
    MVName: string;
    SQBitRate: number;
    '320Size': number;
    '320Hash': string;
    HasMv: boolean;
    PublishAge: number;
    Genre: string;
    SQType: number;
    SQSize: number;
    SQHash: string;
    IsRecorder: boolean;
    AlbumID: string;
    Scid: number;
    MixSongID: number;
    Privilege: number;
    '320Privilege': number;
    SQPrivilege: number;
    FailProcess: number;
    OldCpy: number;
    PayType: number;
    Type: string;
    FullLyric: string;
    Image: string;
    trans_param: Transparam;
    Category: number;
    AlgPath: string;
    vvid: string;
    Weight: number;
    HQ: HQ;
    SQ: HQ;
    Res: HQ;
    Singers: Singer[];
    mvdata: Mvdatum[];
}
interface Mvdatum {
    typ: number;
    id: string;
    hash: string;
    trk: string;
}
interface Singer {
    name: string;
    id: number;
}
interface HQ {
    Hash: string;
    FileSize: number;
    BitRate: number;
    Duration: number;
    ExtName: string;
    Privilege: number;
    FailProcess: number;
    PayType: number;
    PkgPrice: number;
    Price: number;
}
interface Transparam {
    musicpack_advance: number;
    cpy_grade: number;
    ogg_128_hash: string;
    cpy_level: number;
    hash_offset: Hashoffset;
    hash_multitrack: string;
    ogg_128_filesize: number;
    display_rate: number;
    classmap: Classmap;
    language: string;
    display: number;
    pay_block_tpl: number;
    songname_suffix: string;
    qualitymap: Qualitymap;
    ogg_320_filesize: number;
    union_cover: string;
    cpy_attr0: number;
    ogg_320_hash: string;
    ipmap: Classmap;
    cid: number;
}
interface Qualitymap {
    attr1: number;
    bits: string;
    attr0: number;
}
interface Classmap {
    attr0: number;
}
interface Hashoffset {
    file_type: number;
    clip_hash: string;
    start_byte: number;
    end_byte: number;
    start_ms: number;
    end_ms: number;
    offset_hash: string;
}
export {};
