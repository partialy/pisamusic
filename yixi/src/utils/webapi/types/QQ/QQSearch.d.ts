export interface QQSearchResponse {
    result: number;
    data: QQSearchData;
}
interface QQSearchData {
    list: Array<QQSearchSong>;
    pageNo: number;
    pageSize: number;
    total: number;
    key: string;
    t: number;
    type: string;
}
export interface QQSearchSong {
    albumid: number;
    albummid: string;
    albumname: string;
    albumname_hilight: string;
    alertid: number;
    belongCD: number;
    cdIdx: number;
    chinesesinger: number;
    docid: string;
    grp?: Array<any>;
    interval: number;
    isonly: number;
    lyric?: any;
    lyric_hilight?: any;
    media_mid: string;
    msgid: number;
    newStatus: number;
    nt: number;
    pay: Pay;
    preview: Preview;
    pubtime: number;
    pure: number;
    singer: Array<QQSearchSinger>;
    size128: number;
    size320: number;
    sizeape: number;
    sizeflac: number;
    sizeogg: number;
    songid: number;
    songmid: string;
    songname: string;
    songname_hilight: string;
    strMediaMid: string;
    stream: number;
    switch: number;
    t: number;
    tag: number;
    type: number;
    ver: number;
    vid?: any;
}
interface Pay {
    payalbum: number;
    payalbumprice: number;
    paydownload: number;
    payinfo: number;
    payplay: number;
    paytrackmouth: number;
    paytrackprice: number;
}
interface Preview {
    trybegin: number;
    tryend: number;
    trysize: number;
}
export interface QQSearchSinger {
    id: number;
    mid: string;
    name: string;
    name_hilight: string;
}
export {};
