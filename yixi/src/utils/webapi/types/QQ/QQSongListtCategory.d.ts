export interface QQSongListCategoryResponse {
    result: number;
    data: QQSongListCategoryData[];
}
export interface QQSongListCategoryData {
    type: string;
    list: QQSongListCategory[];
}
export interface QQSongListCategory {
    id: number;
    name: string;
}
