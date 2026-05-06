export interface KGPlaylistTagsResponse {
    data: KGTag[];
    status: number;
    error_code: number;
}
export interface KGTag {
    parent_id: string;
    sort: string;
    tag_id: string;
    tag_name: string;
    son?: {
        parent_id: string;
        sort: string;
        tag_id: string;
        tag_name: string;
    }[];
}
