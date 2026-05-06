export interface QQRecommendPlaylistForYou {
    result: number;
    data: QQRecommendPlaylistForYouData;
}
export interface QQRecommendPlaylistForYouData {
    list: QQRecommendPlaylistForYouItem[];
    count: number;
}
export interface QQRecommendPlaylistForYouItem {
    album_pic_mid: string;
    content_id: number;
    cover: string;
    creator: number;
    edge_mark: string;
    id: number;
    is_dj: boolean;
    is_vip: boolean;
    jump_url: string;
    listen_num: number;
    pic_mid: string;
    rcmdcontent: string;
    rcmdtemplate: Rcmdtemplate;
    rcmdtype: number;
    singerid: number;
    title: string;
    tjreport: string;
    type: number;
    username: string;
}
declare enum Rcmdtemplate {
    编辑推荐 = "\u7F16\u8F91\u63A8\u8350"
}
export {};
