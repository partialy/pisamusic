export interface KGSearchSuggestResponse {
    Shortcuts: any[];
    error_code: number;
    SingerShortcut: SingerShortcut;
    ErrorCode: number;
    data: KGSearchSuggestData[];
    status: number;
}
interface SingerShortcut {
    album_count: number;
    id: number;
    fans_count: number;
    name: string;
    img: string;
    song_count: number;
}
export interface KGSearchSuggestData {
    RecordCount: number;
    LableName: string;
    RecordDatas: KGSearchSuggestItem[];
}
interface KGSearchSuggestItem {
    Use?: Use;
    la?: number;
    IsRadio: number;
    tags_v2?: any[];
    IsKlist?: number;
    HintInfo: string;
    MatchCount: number;
    Hot: number;
    tags?: string[];
}
declare enum Use {
    KlistTipStandardV1 = "klist_tip_standard_v1_"
}
export {};
