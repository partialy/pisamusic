export interface WYPlaylistTrackResponse {
    songs: WYPlaylistSong[];
    privileges: Privilege[];
    code: number;
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
    maxBrLevel: Level;
    playMaxBrLevel: Level;
    downloadMaxBrLevel: Level;
    plLevel: Level;
    dlLevel: Level;
    flLevel: Level;
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
declare enum Level {
    Exhigh = "exhigh",
    Hires = "hires",
    Lossless = "lossless",
    None = "none"
}
interface FreeTrialPrivilege {
    resConsumable: boolean;
    userConsumable: boolean;
    listenType: null;
    cannotListenReason: null;
    playReason: null;
    freeLimitTagType: null;
}
export interface WYPlaylistSong {
    name: string;
    mainTitle: null;
    additionalTitle: null;
    id: number;
    pst: number;
    t: number;
    ar: Ar[];
    alia: string[];
    pop: number;
    st: number;
    rt: Rt;
    fee: number;
    v: number;
    crbt: null;
    cf: string;
    al: Al;
    dt: number;
    h: H;
    m: H;
    l: H;
    sq: H | null;
    hr: H | null;
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
    originSongSimpleData: null;
    tagPicList: null;
    resourceState: boolean;
    version: number;
    songJumpInfo: null;
    entertainmentTags: null;
    awardTags: null;
    displayTags: null;
    single: number;
    noCopyrightRcmd: NoCopyrightRcmd | null;
    mv: number;
    mst: number;
    cp: number;
    rtype: number;
    rurl: null;
    publishTime: number;
}
interface Al {
    id: number;
    name: string;
    picUrl: string;
    tns: any[];
    pic_str?: string;
    pic: number;
}
interface Ar {
    id: number;
    name: string;
    tns: any[];
    alias: any[];
}
interface H {
    br: number;
    fid: number;
    size: number;
    vd: number;
    sr: number;
}
interface NoCopyrightRcmd {
    type: number;
    typeDesc: string;
    songId: null;
    thirdPartySong: null;
    expInfo: null;
}
declare enum Rt {
    Empty = "",
    The600902000008002738 = "600902000008002738"
}
export {};
