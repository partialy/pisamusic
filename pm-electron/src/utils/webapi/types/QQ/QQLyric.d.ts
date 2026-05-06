export interface QQLyricResponse {
    result: number;
    data: QQLyricData;
}
export interface QQLyricData {
    retcode: number;
    code: number;
    subcode: number;
    lyric: string;
    trans: string;
}
