export interface WYPlaylistHighqualityTagsResponse {
    tags: WYPlaylistHighqualityTags[];
    code: number;
}
export interface WYPlaylistHighqualityTags {
    id: number;
    name: string;
    type: number;
    category: number;
    hot: boolean;
}
