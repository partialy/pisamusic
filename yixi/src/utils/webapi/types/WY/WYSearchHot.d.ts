export interface WYSearchHotResponse {
    code: number;
    result: WYSearchHotResult;
}
export interface WYSearchHotResult {
    hots: WYSearchHotItem[];
}
export interface WYSearchHotItem {
    first: string;
    second: number;
    third: null;
    iconType: number;
}
