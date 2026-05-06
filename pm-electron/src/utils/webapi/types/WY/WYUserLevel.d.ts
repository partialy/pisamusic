export interface WYUserLevelResponse {
    full: boolean;
    data: WYUserLevelData;
    code: number;
}
export interface WYUserLevelData {
    userId: number;
    info: string;
    progress: number;
    nextPlayCount: number;
    nextLoginCount: number;
    nowPlayCount: number;
    nowLoginCount: number;
    level: number;
}
