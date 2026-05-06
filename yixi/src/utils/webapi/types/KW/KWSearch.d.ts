export interface KWSearchResponse {
    msg: string;
    data: Array<KWSong>;
}
export interface KWSong {
    album: string;
    album_id: number;
    artist: string;
    duration: number;
    name: string;
    id: number;
    quality: KWQuality;
}
export interface KWQuality {
    lossless: Lossless;
    exhigh: Exhigh;
    standard: Standard;
}
interface Lossless {
    size: string;
}
interface Exhigh {
    size: string;
}
interface Standard {
    size: string;
}
export {};
