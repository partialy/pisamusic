export interface WYSearchResponse {
    result: WYSearchResult;
    code: number;
    trp: Trp;
}
export interface WYSearchResult {
    songs: Array<WYSearchSong>;
    hasMore: boolean;
    songCount: number;
}
interface Trp {
    rules: Array<string>;
}
export interface WYSearchSong {
    album: Album;
    fee: number;
    duration: number;
    rtype: number;
    ftype: number;
    artists: Array<Artists>;
    copyrightId: number;
    mvid: number;
    name: string;
    alias?: Array<any>;
    id: number;
    mark: number;
    status: number;
}
interface Album {
    publishTime: number;
    size: number;
    artist: Artist;
    copyrightId: number;
    name: string;
    id: number;
    picId: number;
    mark: number;
    status: number;
}
interface Artists {
    img1v1Url: string;
    img1v1: number;
    name: string;
    alias?: Array<any>;
    id: number;
    albumSize: number;
    picId: number;
}
interface Artist {
    img1v1Url: string;
    img1v1: number;
    name?: any;
    alias?: Array<any>;
    id: number;
    albumSize: number;
    picId: number;
}
export {};
