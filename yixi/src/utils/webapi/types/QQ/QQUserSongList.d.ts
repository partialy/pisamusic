export interface QQUserSongListResponse {
    result: number;
    data: QQUserSongListData;
}
export interface QQUserSongListData {
    list: QQUserSongList[];
    creator: Creator;
}
interface Creator {
    hostuin: string;
    encrypt_uin: string;
    hostname: string;
}
export interface QQUserSongList {
    diss_name: string;
    diss_cover: string;
    song_cnt: number;
    listen_num: number;
    dirid: number;
    tid: number;
    dir_show: number;
}
export {};
