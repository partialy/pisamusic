export interface WYQualityRes {
    data: WYQualityData;
    code: number;
    message: string;
    success: boolean;
    error: boolean;
}
export interface WYQualityData {
    songId: number;
    h: H;
    m: H;
    l: H;
    sq: H;
    hr: H;
    db: null;
    jm: H;
    je: H;
    sk: Sk;
    sks: Sk[];
    vi: H;
}
interface Sk {
    br: number;
    fid: number;
    size: number;
    vd: number;
    sr: number;
    it: string;
}
interface H {
    br: number;
    fid: number;
    size: number;
    vd: number;
    sr: number;
}
export {};
