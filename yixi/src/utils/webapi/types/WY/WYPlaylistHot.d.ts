export interface WYPlaylistHotResponse {
    tags: WYPlaylistHotTag[];
    code: number;
}
export interface WYPlaylistHotTag {
    playlistTag: PlaylistTag;
    activity: boolean;
    usedCount: number;
    hot: boolean;
    category: number;
    createTime: number;
    position: number;
    name: string;
    id: number;
    type: number;
}
interface PlaylistTag {
    id: number;
    name: string;
    category: number;
    usedCount: number;
    type: number;
    position: number;
    createTime: number;
    highQuality: number;
    highQualityPos: number;
    officialPos: number;
}
export {};
