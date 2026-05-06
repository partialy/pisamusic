export interface KGSearchSong {
    PublishTime?: any;
    Audioid: number;
    OldCpy: number;
    PublishAge: number;
    PayType: number;
    TagContent: string;
    Accompany: number;
    SingerName: string;
    ShowingFlag: number;
    Source?: any;
    SQ: SQ;
    AlbumAux?: any;
    Image: string;
    HQ: HQ;
    M4aSize: number;
    HeatLevel: number;
    trans_param: Trans_param;
    UploaderContent?: any;
    FileSize: number;
    IsOriginal: number;
    FileHash: string;
    FoldType: number;
    Grp: Array<Grp>;
    isPrepublish: number;
    Type: string;
    Bitrate: number;
    ExtName: string;
    AlbumPrivilege: number;
    AlbumID: string;
    AlbumName: string;
    mvdata: Array<Mvdata>;
    OtherName?: any;
    Res: Res;
    SourceID: number;
    MixSongID: string;
    Singers: Array<KGSingers>;
    Suffix?: any;
    MatchFlag: number;
    Scid: number;
    OriSongName: string;
    FailProcess: number;
    RankId: number;
    PublishDate: Date;
    Auxiliary?: any;
    TagDetails: Array<TagDetails>;
    PrepublishInfo: PrepublishInfo;
    OwnerCount: number;
    Uploader?: any;
    Duration: number;
    TopID: number;
    FileName: string;
    recommend_type: number;
}
interface SQ {
    FileSize: number;
    Hash: string;
    Privilege: number;
}
interface HQ {
    FileSize: number;
    Hash: string;
    Privilege: number;
}
interface Trans_param {
    ogg_128_hash: string;
    classmap: Classmap;
    language: string;
    cpy_attr0: number;
    musicpack_advance: number;
    ogg_128_filesize: number;
    display_rate: number;
    union_cover: string;
    qualitymap: Qualitymap;
    ogg_320_filesize: number;
    ogg_320_hash: string;
    cid: number;
    cpy_grade: number;
    display: number;
    ipmap: Ipmap;
    hash_offset: Hash_offset;
    hash_multitrack: string;
    pay_block_tpl: number;
    cpy_level: number;
}
interface Grp {
    PublishTime?: any;
    Audioid: number;
    OldCpy: number;
    PublishAge: number;
    PayType: number;
    TagContent?: any;
    Accompany: number;
    SingerName: string;
    ShowingFlag: number;
    Source?: any;
    AlbumAux?: any;
    Image: string;
    SQ: SQ;
    M4aSize: number;
    HQ: HQ;
    HeatLevel: number;
    UploaderContent?: any;
    FileSize: number;
    IsOriginal: number;
    FileHash: string;
    trans_param: Trans_param;
    Type: string;
    Bitrate: number;
    isPrepublish: number;
    ExtName: string;
    mvdata: Array<Mvdata>;
    AlbumPrivilege: number;
    AlbumID: string;
    AlbumName: string;
    OtherName?: any;
    SourceID: number;
    MixSongID: string;
    Singers: Array<KGSingers>;
    Suffix?: any;
    MatchFlag: number;
    Scid: number;
    OriSongName: string;
    FailProcess: number;
    RankId: number;
    PublishDate: Date;
    Auxiliary?: any;
    TagDetails?: Array<any>;
    PrepublishInfo: PrepublishInfo;
    OwnerCount: number;
    Uploader?: any;
    Duration: number;
    TopID: number;
    FileName: string;
    recommend_type: number;
}
interface Mvdata {
    typ: number;
    trk: string;
    hash: string;
    id: string;
}
interface Res {
    FileSize: number;
    Privilege: number;
    Hash: string;
    BitRate: number;
    TimeLength: number;
}
interface KGSingers {
    name: string;
    ip_id: number;
    id: number;
}
interface TagDetails {
    content: string;
    version: number;
    type: number;
}
interface PrepublishInfo {
    ReserveCount: number;
    DisplayTime?: any;
    Id: number;
    PublishTime?: any;
}
interface Classmap {
    attr0: number;
}
interface Qualitymap {
    attr0: number;
    attr1: number;
}
interface Ipmap {
    attr0: number;
}
interface Hash_offset {
    clip_hash: string;
    start_byte: number;
    end_ms: number;
    end_byte: number;
    file_type: number;
    start_ms: number;
    offset_hash: string;
}
interface SQ {
    FileSize: number;
    Hash: string;
    Privilege: number;
}
interface HQ {
    FileSize: number;
    Hash: string;
    Privilege: number;
}
interface Trans_param {
    pay_block_tpl: number;
    union_cover: string;
    language: string;
    cpy_attr0: number;
    musicpack_advance: number;
    display: number;
    display_rate: number;
    qualitymap: Qualitymap;
    cpy_level: number;
    cpy_grade: number;
    cid: number;
    ogg_128_filesize: number;
    classmap: Classmap;
    hash_multitrack: string;
    ipmap: Ipmap;
    ogg_320_hash: string;
    ogg_128_hash: string;
    ogg_320_filesize: number;
}
interface Mvdata {
    id: string;
    trk: string;
    hash: string;
    typ: number;
}
interface PrepublishInfo {
    ReserveCount: number;
    DisplayTime?: any;
    Id: number;
    PublishTime?: any;
}
interface Qualitymap {
    attr0: number;
    attr1: number;
}
interface Classmap {
    attr0: number;
}
interface Ipmap {
    attr0: number;
}
export {};
