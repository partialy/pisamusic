export interface QQSongListListResponse {
    result: number;
    data: QQSongListListData;
}
export interface QQSongListListData {
    list: QQSongListList[];
    sort: number;
    category: number;
    pageNo: number;
    pageSize: number;
    total: number;
}
export interface QQSongListList {
    dissid: string;
    createtime: Date;
    commit_time: Date;
    dissname: string;
    imgurl: string;
    introduction: string;
    listennum: number;
    score: number;
    version: number;
    creator: Creator;
}
interface Creator {
    type: number;
    qq: number;
    encrypt_uin: string;
    name: string;
    isVip: number;
    avatarUrl: string;
    followflag: number;
}
export {};
