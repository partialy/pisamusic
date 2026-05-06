export interface WYHighQualityListsResponse {
    playlists: WYHighQualityPlaylist[];
    code: number;
    more: boolean;
    lasttime: number;
    total: number;
}
export interface WYHighQualityPlaylist {
    name: string;
    id: number;
    trackNumberUpdateTime: number;
    status: number;
    userId: number;
    createTime: number;
    updateTime: number;
    subscribedCount: number;
    trackCount: number;
    cloudTrackCount: number;
    coverImgUrl: string;
    coverImgId: number;
    description: string;
    tags: string[];
    playCount: number;
    trackUpdateTime: number;
    specialType: number;
    totalDuration: number;
    creator: Creator;
    tracks: null;
    subscribers: Creator[];
    subscribed: boolean;
    commentThreadId: string;
    newImported: boolean;
    adType: number;
    highQuality: boolean;
    privacy: number;
    ordered: boolean;
    anonimous: boolean;
    coverStatus: number;
    recommendInfo: null;
    socialPlaylistCover: null;
    recommendText: null;
    shareCount: number;
    coverImgId_str?: string;
    commentCount: number;
    copywriter: string;
    tag: string;
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
    description: Description;
    detailDescription: DetailDescription;
    avatarImgId: number;
    backgroundImgId: number;
    backgroundUrl: string;
    authority: number;
    mutual: boolean;
    expertTags: string[] | null;
    experts: {
        [key: string]: string;
    } | null;
    djStatus: number;
    vipType: number;
    remarkName: null;
    authenticationTypes: number;
    avatarDetail: AvatarDetail | null;
    avatarImgIdStr: string;
    backgroundImgIdStr: string;
    anchor: boolean;
    avatarImgId_str?: string;
}
interface AvatarDetail {
    userType: number;
    identityLevel: number;
    identityIconUrl: string;
}
declare enum Description {
    Empty = "",
    悠米音悦台云分享 = "\u60A0\u7C73\u97F3\u60A6\u53F0\u4E91\u5206\u4EAB",
    电台Dj = "\u7535\u53F0DJ"
}
declare enum DetailDescription {
    Empty = "",
    悠米音悦台云分享 = "\u60A0\u7C73\u97F3\u60A6\u53F0\u4E91\u5206\u4EAB",
    电台DJ阿峻 = "\u7535\u53F0DJ\u963F\u5CFB"
}
export {};
