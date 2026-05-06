export interface WYCloudSearchListResponse {
    result: WYCloudSearchListResult | SearchAlbumResult | MVResult | WYLyricResult;
    code: number;
}
export interface WYCloudSearchListResult {
    searchQcReminder: null;
    playlists: WYCloudSearchListItem[];
    playlistCount: number;
}
export interface WYCloudSearchListItem {
    id: number;
    name: string;
    coverImgUrl: string;
    creator: Creator;
    subscribed: boolean;
    trackCount: number;
    userId: number;
    playCount: number;
    bookCount: number;
    specialType: number;
    officialTags: null;
    action: null;
    actionType: null;
    recommendText: null;
    score: null;
    officialPlaylistTitle: null;
    playlistType: string;
    description: null | string;
    highQuality: boolean;
}
interface Creator {
    nickname: string;
    userId: number;
    userType: number;
    avatarUrl: null;
    authStatus: number;
    expertTags: null;
    experts: null;
}
interface SearchAlbumResult {
    albums: WYSearchAlbumItem[];
    albumCount: number;
}
export interface WYSearchAlbumItem {
    name: string;
    id: number;
    idStr: string;
    type: string;
    size: number;
    picId: number;
    blurPicUrl: string;
    companyId: number;
    pic: number;
    picUrl: string;
    publishTime: number;
    description: string;
    tags: string;
    company: null | string;
    briefDesc: string;
    artist: Artist;
    songs: any[];
    alias: any[];
    status: number;
    copyrightId: number;
    commentThreadId: string;
    artists: Artist2[];
    onSale: boolean;
    picId_str?: string;
    isSub: boolean;
}
interface Artist2 {
    name: string;
    id: number;
    picId: number;
    img1v1Id: number;
    briefDesc: string;
    picUrl: string;
    img1v1Url: string;
    albumSize: number;
    alias: any[];
    trans: string;
    musicSize: number;
    topicPerson: number;
}
interface Artist {
    name: string;
    id: number;
    picId: number;
    img1v1Id: number;
    briefDesc: string;
    picUrl: string;
    img1v1Url: string;
    albumSize: number;
    alias: string[];
    trans: string;
    musicSize: number;
    topicPerson: number;
    picId_str: string;
}
interface MVResult {
    mvCount: number;
    mvs: WYMvItem[];
}
export interface WYMvItem {
    id: number;
    cover: string;
    name: string;
    playCount: number;
    briefDesc: null;
    desc: null;
    artistName: string;
    artistId: number;
    duration: number;
    mark: number;
    artists: Artist[];
    transNames: null;
    alias: string[];
}
interface Artist {
    id: number;
    name: string;
    alias: string[];
    transNames: null;
}
interface WYLyricResult {
    searchQcReminder: null;
    songs: WYLyricItem[];
    songCount: number;
}
export interface WYLyricItem {
    name: string;
    id: number;
    pst: number;
    t: number;
    ar: Ar[];
    alia: any[];
    pop: number;
    st: number;
    rt: string;
    fee: number;
    v: number;
    crbt: null;
    cf: string;
    al: Al;
    dt: number;
    h: H;
    m: H;
    l: H;
    sq: H;
    hr: null;
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
    single: number;
    noCopyrightRcmd: null;
    rtype: number;
    rurl: null;
    mst: number;
    cp: number;
    mv: number;
    publishTime: number;
    privilege: Privilege;
    lyrics: string[];
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
    maxBrLevel: string;
    playMaxBrLevel: string;
    downloadMaxBrLevel: string;
    plLevel: string;
    dlLevel: string;
    flLevel: string;
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
interface FreeTrialPrivilege {
    resConsumable: boolean;
    userConsumable: boolean;
    listenType: null;
    cannotListenReason: null;
    playReason: null;
    freeLimitTagType: null;
}
interface H {
    br: number;
    fid: number;
    size: number;
    vd: number;
    sr: number;
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
    alias: any[];
}
export {};
