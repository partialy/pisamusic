export interface KGUrlResponse {
    extName: string;
    classmap: Classmap;
    status: number;
    volume: number;
    std_hash_time: number;
    backupUrl: Array<string>;
    url: Array<string>;
    std_hash: string;
    tracker_through: Tracker_through;
    trans_param: Trans_param;
    fileHead: number;
    auth_through?: Array<any>;
    timeLength: number;
    bitRate: number;
    priv_status: number;
    volume_peak: number;
    volume_gain: number;
    q: number;
    fileName: string;
    fileSize: number;
    hash: string;
}
interface Classmap {
    attr0: number;
}
interface Tracker_through {
    identity_block: number;
    cpy_grade: number;
    musicpack_advance: number;
    all_quality_free: number;
    cpy_level: number;
}
interface Trans_param {
    display_rate: number;
    display: number;
    ogg_128_hash: string;
    qualitymap: Qualitymap;
    pay_block_tpl: number;
    union_cover: string;
    language: string;
    hash_multitrack: string;
    cpy_attr0: number;
    ipmap: Ipmap;
    ogg_320_hash: string;
    classmap: Classmap;
    ogg_128_filesize: number;
    ogg_320_filesize: number;
}
interface Qualitymap {
    attr0: number;
    attr1: number;
}
interface Ipmap {
    attr0: number;
}
interface Classmap {
    attr0: number;
}
export {};
