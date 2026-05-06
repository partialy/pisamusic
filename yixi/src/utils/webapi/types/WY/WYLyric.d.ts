export interface WYLyricResponse {
    sgc: boolean;
    sfy: boolean;
    qfy: boolean;
    lrc: Klyric;
    klyric: Klyric;
    tlyric: Klyric;
    romalrc: Klyric;
    code: number;
}
interface Klyric {
    version: number;
    lyric: string;
}
export {};
