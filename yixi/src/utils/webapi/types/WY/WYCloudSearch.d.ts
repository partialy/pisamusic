export interface WYCloudSearchResponse {
    result: WYCloudSearchResult;
    code: number;
}
export interface WYCloudSearchResult {
    searchQcReminder: null;
    songs: WYCloudSearchSong[];
    songCount: number;
}
export interface WYCloudSearchSong {
    name: string;
    id: number;
    pst: number;
    t: number;
    ar: Ar[];
    alia: string[];
    pop: number;
    st: number;
    rt: string;
    fee: number;
    v: number;
    crbt: null;
    cf: string;
    al: Al;
    dt: number;
    h: L | null;
    m: L | null;
    l: L;
    sq: L | null;
    hr: L | null;
    a: null;
    cd: string;
    no: number;
    rtUrl: null;
    ftype: number;
    rtUrls: any[];
    djId: number;
    copyright: number;
    s_id: number;
    mark: number;
    originCoverType: number;
    originSongSimpleData: OriginSongSimpleData | null;
    tagPicList: null;
    resourceState: boolean;
    version: number;
    songJumpInfo: null;
    entertainmentTags: null;
    single: number;
    noCopyrightRcmd: null;
    rtype: number;
    rurl: null;
    mst: number;
    cp: number;
    mv: number;
    publishTime: number;
    privilege: Privilege;
    tns?: string[];
}
interface Al {
    id: number;
    name: string;
    picUrl: string;
    tns: any[];
    pic_str: string;
    pic: number;
}
interface Ar {
    id: number;
    name: string;
    tns: any[];
    alias: string[];
    alia?: string[];
}
interface L {
    br: number;
    fid: number;
    size: number;
    vd: number;
    sr: number;
}
interface OriginSongSimpleData {
    songId: number;
    name: string;
    artists: AlbumMeta[];
    albumMeta: AlbumMeta;
}
interface AlbumMeta {
    id: number;
    name: string;
}
interface Privilege {
    id: number;
    fee: number;
    payed: number;
    st: number;
    pl: number;
    dl: number;
    sp: number;
    cp: number;
    subp: number;
    cs: boolean;
    maxbr: number;
    fl: number;
    toast: boolean;
    flag: number;
    preSell: boolean;
    playMaxbr: number;
    downloadMaxbr: number;
    maxBrLevel: MaxBrLevel;
    playMaxBrLevel: MaxBrLevel;
    downloadMaxBrLevel: MaxBrLevel;
    plLevel: LLevel;
    dlLevel: LLevel;
    flLevel: LLevel;
    rscl: null;
    freeTrialPrivilege: FreeTrialPrivilege;
    rightSource: number;
    chargeInfoList: ChargeInfoList[];
    code: number;
    message: null;
    plLevels: null;
    dlLevels: null;
    ignoreCache: null;
    bd: null;
}
interface ChargeInfoList {
    rate: number;
    chargeUrl: null;
    chargeMessage: null;
    chargeType: number;
}
declare enum LLevel {
    Exhigh = "exhigh",
    Jyeffect = "jyeffect",
    Standard = "standard"
}
declare enum MaxBrLevel {
    Sky = "sky"
}
interface FreeTrialPrivilege {
    resConsumable: boolean;
    userConsumable: boolean;
    listenType: null;
    cannotListenReason: null;
    playReason: null;
    freeLimitTagType: null;
}
export {};
