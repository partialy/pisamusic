export interface WYPlaylistCatListResponse {
    code: number;
    all: WYPlaylistCatItem;
    sub: WYPlaylistCatItem[];
    categories: {
        "0": "语种";
        "1": "风格";
        "2": "场景";
        "3": "情感";
        "4": "主题";
    };
}
export interface WYPlaylistCatItem {
    name: string;
    resourceCount: number;
    imgId: number;
    imgUrl: null;
    type: number;
    category: number;
    resourceType: number;
    hot: boolean;
    activity: boolean;
}
