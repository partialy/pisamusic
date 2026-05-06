export interface QQRecommendListCategoryResponse {
    result: number;
    data: QQRecommendListCategoryData;
}
export interface QQRecommendListCategoryData {
    total: number;
    list: QQRecommendListCategory[];
    id: number;
    pageNo: number;
    pageSize: number;
}
export interface QQRecommendListCategory {
    access_num: number;
    album_pic_mid: AlbumPicMid;
    censor_remark: any[];
    censor_status: number;
    censor_time: number;
    commit_time: number;
    cover_mid: string;
    cover_url_big: string;
    cover_url_medium: string;
    cover_url_small: string;
    create_time: number;
    creator_info: CreatorInfo;
    creator_uin: number;
    desc: string;
    dirid: number;
    fav_num: number;
    modify_time: number;
    pic_mid: string;
    rcmdcontent: string;
    rcmdtemplate: string;
    score: number;
    song_ids: number[];
    song_types: number[];
    tag_ids: number[];
    tag_names: any[];
    tid: number;
    title: string;
    tjreport: string;
}
declare enum AlbumPicMid {
    Empty = "",
    The0007EEj312JFeD = "0007eEj312jFeD"
}
interface CreatorInfo {
    avatar: string;
    is_dj: number;
    nick: Nick;
    taoge_avatar: string;
    taoge_nick: string;
    uin: number;
    vip_type: number;
}
declare enum Nick {
    QQ音乐官方歌单 = "QQ\u97F3\u4E50\u5B98\u65B9\u6B4C\u5355",
    幻菱 = "\u5E7B\u83F1"
}
export {};
