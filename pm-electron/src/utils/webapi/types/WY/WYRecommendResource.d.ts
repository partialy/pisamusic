export interface WYRecommendResourceResponse {
    code: number;
    featureFirst: boolean;
    haveRcmdSongs: boolean;
    recommend: WYRecommendResource[];
}
export interface WYRecommendResource {
    id: number;
    type: number;
    name: string;
    copywriter: string;
    picUrl: string;
    playcount: number;
    createTime: number;
    creator: Creator;
    trackCount: number;
    userId: number;
    alg: string;
}
interface Creator {
    backgroundImgIdStr: string;
    avatarImgIdStr: string;
    birthday: number;
    province: number;
    city: number;
    vipType: number;
    accountStatus: number;
    avatarUrl: string;
    authStatus: number;
    userType: number;
    nickname: string;
    gender: number;
    backgroundUrl: string;
    avatarImgId: number;
    backgroundImgId: number;
    detailDescription: string;
    defaultAvatar: boolean;
    expertTags: null;
    djStatus: number;
    followed: boolean;
    mutual: boolean;
    remarkName: null;
    description: string;
    userId: number;
    signature: string;
    authority: number;
}
export {};
