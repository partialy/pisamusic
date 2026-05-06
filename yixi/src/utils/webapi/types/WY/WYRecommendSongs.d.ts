export interface WYRecommendSongsResponse {
    code: number;
    data: WYRecommendSongsData;
}
export interface WYRecommendSongsData {
    fromCache: boolean;
    dailySongs: WYRecommendSong[];
    orderSongs: any[];
    recommendReasons: RecommendReason[];
    mvResourceInfos: null;
    demote: boolean;
    algReturnDemote: boolean;
    dailyRecommendInfo: null;
}
export interface WYRecommendSong {
    name: string;
    mainTitle: null | string;
    additionalTitle: null | string;
    id: number;
    pst: number;
    t: number;
    ar: Ar[];
    alia: string[];
    pop: number;
    st: number;
    rt: Rt | null;
    fee: number;
    v: number;
    crbt: null;
    cf: string;
    al: Al;
    dt: number;
    h: L | null;
    m: L;
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
    originSongSimpleData: null;
    tagPicList: null;
    resourceState: boolean;
    version: number;
    songJumpInfo: null;
    entertainmentTags: null;
    awardTags: null;
    displayTags: null;
    single: number;
    noCopyrightRcmd: null;
    rtype: number;
    rurl: null;
    mst: number;
    cp: number;
    mv: number;
    publishTime: number;
    reason: null | string;
    recommendReason: null | string;
    privilege: Privilege;
    alg: string;
    tns?: string[];
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
interface L {
    br: number;
    fid: number;
    size: number;
    vd: number;
    sr: number;
}
interface Privilege {
    id: number;
    fee: number;
    payed: number;
    realPayed: number;
    st: number;
    pl: number;
    dl: number;
    sp: number;
    cp: number;
    subp: number;
    cs: boolean;
    maxbr: number;
    fl: number;
    pc: null;
    toast: boolean;
    flag: number;
    paidBigBang: boolean;
    preSell: boolean;
    playMaxbr: number;
    downloadMaxbr: number;
    maxBrLevel: Level;
    playMaxBrLevel: Level;
    downloadMaxBrLevel: Level;
    plLevel: Level;
    dlLevel: Level;
    flLevel: FLLevel;
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
    Lossless = "lossless"
}
declare enum FLLevel {
    Exhigh = "exhigh",
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
declare enum Rt {
    Empty = "",
    The600902000005510572 = "600902000005510572",
    The600902000007999882 = "600902000007999882",
    The600902000009048672 = "600902000009048672"
}
interface RecommendReason {
    songId: number;
    reason: string;
    reasonId: null | string;
    targetUrl: null;
}
export {};
