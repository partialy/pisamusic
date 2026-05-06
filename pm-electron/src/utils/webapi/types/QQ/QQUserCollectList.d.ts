export interface QQUserCollectListResponse {
    result: number;
    data: QQUserCollectListData;
}
export interface QQUserCollectListData {
    list: QQUserCollectListItem[];
    total: number;
    pageNo: number;
    pageSize: number;
}
export interface QQUserCollectListItem {
    dissid: number;
    dissname: string;
    songnum: number;
    listennum: number;
    logo: string;
    dirid: number;
    dirtype: number;
    isshow: number;
    dir_show: number;
    uin: number;
    encrypt_uin: string;
    nickname: string;
    createtime: number;
    type: number;
}
