export interface WYPlaylistDetailResponse {
    code: number;
    relatedVideos: null;
    playlist: WYPlaylistDetail;
    urls: null;
    privileges: Privilege[];
    sharedPrivilege: null;
    resEntrance: null;
    fromUsers: null;
    fromUserCount: number;
    songFromUsers: null;
}
export interface WYPlaylistDetail {
    id: number;
    name: string;
    coverImgId: number;
    coverImgUrl: string;
    coverImgId_str: null;
    adType: number;
    userId: number;
    createTime: number;
    status: number;
    opRecommend: boolean;
    highQuality: boolean;
    newImported: boolean;
    updateTime: number;
    trackCount: number;
    specialType: number;
    privacy: number;
    trackUpdateTime: number;
    commentThreadId: string;
    playCount: number;
    trackNumberUpdateTime: number;
    subscribedCount: number;
    cloudTrackCount: number;
    ordered: boolean;
    description: string;
    tags: string[];
    updateFrequency: null;
    backgroundCoverId: number;
    backgroundCoverUrl: null;
    titleImage: number;
    titleImageUrl: null;
    detailPageTitle: null;
    englishTitle: null;
    officialPlaylistType: null;
    copied: boolean;
    relateResType: null;
    coverStatus: number;
    subscribers: Creator[];
    subscribed: boolean;
    creator: Creator;
    tracks: Track[];
    videoIds: null;
    videos: null;
    trackIds: TrackID[];
    bannedTrackIds: null;
    mvResourceInfos: null;
    shareCount: number;
    commentCount: number;
    remixVideo: null;
    newDetailPageRemixVideo: null;
    sharedUsers: null;
    historySharedUsers: null;
    gradeStatus: string;
    score: string;
    algTags: null;
    distributeTags: any[];
    trialMode: number;
    displayTags: null;
    displayUserInfoAsTagOnly: boolean;
    playlistType: string;
    bizExtInfo: BizEXTInfo;
}
interface BizEXTInfo {
}
interface Creator {
    defaultAvatar: boolean;
    province: number;
    authStatus: number;
    followed: boolean;
    avatarUrl: string;
    accountStatus: number;
    gender: number;
    city: number;
    birthday: number;
    userId: number;
    userType: number;
    nickname: string;
    signature: string;
    description: string;
    detailDescription: string;
    avatarImgId: number;
    backgroundImgId: number;
    backgroundUrl: string;
    authority: number;
    mutual: boolean;
    expertTags: string[] | null;
    experts: null;
    djStatus: number;
    vipType: number;
    remarkName: null;
    authenticationTypes: number;
    avatarDetail: AvatarDetail | null;
    anchor: boolean;
    avatarImgIdStr: string;
    backgroundImgIdStr: string;
    avatarImgId_str: string;
}
interface AvatarDetail {
    userType: number;
    identityLevel: number;
    identityIconUrl: string;
}
interface TrackID {
    id: number;
    v: number;
    t: number;
    at: number;
    alg: null;
    uid: number;
    rcmdReason: string;
    rcmdReasonTitle: RcmdReasonTitle;
    sc: null;
    f: null;
    sr: null;
    dpr: null;
}
declare enum RcmdReasonTitle {
    编辑推荐 = "\u7F16\u8F91\u63A8\u8350"
}
interface Track {
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
    originSongSimpleData: OriginSongSimpleData | null;
    tagPicList: null;
    resourceState: boolean;
    version: number;
    songJumpInfo: null;
    entertainmentTags: null;
    awardTags: null;
    displayTags: null;
    single: number;
    noCopyrightRcmd: NoCopyrightRcmd | null;
    alg: null;
    displayReason: null;
    rtype: number;
    rurl: null;
    mst: number;
    cp: number;
    mv: number;
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
declare enum Rt {
    Empty = "",
    The600902000008002738 = "600902000008002738"
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
export {};
