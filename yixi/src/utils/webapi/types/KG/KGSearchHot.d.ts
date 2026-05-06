export interface KGSearchHotResponse {
    status: number;
    errcode: number;
    data: KGSearchHotData;
    error: string;
}
export interface KGSearchHotData {
    timestamp: number;
    list: KGSearchHotList[];
}
export interface KGSearchHotList {
    name: string;
    keywords: Keyword[];
}
interface Keyword {
    reason: string;
    json_url: string;
    jumpurl: string;
    keyword: string;
    is_cover_word: number;
    type: number;
    icon: number;
}
export {};
