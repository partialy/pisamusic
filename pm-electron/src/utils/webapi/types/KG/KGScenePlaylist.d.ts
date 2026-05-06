export interface KGScenePlaylistResponse {
    data: KGScenePlaylistData;
    errcode: number;
    status: number;
    error: string;
}
export interface KGScenePlaylistData {
    timestamp: number;
    list: KGScenePlaylistItem[];
}
export interface KGScenePlaylistItem {
    is_publish: number;
    id: string;
    specialid: number;
    content_type: number;
    author_info: AuthorInfo;
    content_id: string;
    play_count: number;
    title: string;
    song_count: number;
    cover: string;
    slid: number;
    create_time: number;
    intro: string;
    song_userid: number;
}
interface AuthorInfo {
    user_pic: string;
    user_name: string;
    user_id: number;
}
export {};
