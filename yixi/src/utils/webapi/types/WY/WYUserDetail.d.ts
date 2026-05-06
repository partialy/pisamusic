export interface WYUserDetailResponse {
    level: number;
    listenSongs: number;
    userPoint: UserPoint;
    mobileSign: boolean;
    pcSign: boolean;
    profile: WYUserDetailProfile;
    peopleCanSeeMyPlayRecord: boolean;
    bindings: WYUserDetailBinding[];
    adValid: boolean;
    code: number;
    newUser: boolean;
    recallUser: boolean;
    createTime: number;
    createDays: number;
    profileVillageInfo: ProfileVillageInfo;
}
export interface WYUserDetailBinding {
    expiresIn: number;
    refreshTime: number;
    bindingTime: number;
    tokenJsonStr: null;
    url: string;
    expired: boolean;
    userId: number;
    id: number;
    type: number;
}
export interface WYUserDetailProfile {
    privacyItemUnlimit: PrivacyItemUnlimit;
    avatarDetail: null;
    vipType: number;
    mutual: boolean;
    remarkName: null;
    avatarImgId: number;
    birthday: number;
    gender: number;
    nickname: string;
    province: number;
    followed: boolean;
    detailDescription: string;
    userType: number;
    accountStatus: number;
    avatarUrl: string;
    djStatus: number;
    backgroundImgId: number;
    backgroundUrl: string;
    defaultAvatar: boolean;
    city: number;
    experts: Experts;
    authStatus: number;
    expertTags: null;
    avatarImgIdStr: string;
    backgroundImgIdStr: string;
    createTime: number;
    description: string;
    userId: number;
    signature: string;
    authority: number;
    followeds: number;
    follows: number;
    blacklist: boolean;
    eventCount: number;
    allSubscribedCount: number;
    playlistBeSubscribedCount: number;
    followTime: null;
    followMe: boolean;
    artistIdentity: any[];
    cCount: number;
    inBlacklist: boolean;
    sDJPCount: number;
    playlistCount: number;
    sCount: number;
    newFollows: number;
}
interface Experts {
}
interface PrivacyItemUnlimit {
    area: boolean;
    college: boolean;
    gender: boolean;
    age: boolean;
    villageAge: boolean;
}
interface ProfileVillageInfo {
    title: string;
    imageUrl: null;
    targetUrl: string;
}
interface UserPoint {
    userId: number;
    balance: number;
    updateTime: number;
    version: number;
    status: number;
    blockBalance: number;
}
export {};
