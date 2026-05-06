export interface QQSongSimilarResponse {
    result: number;
    data: QQSongSimilar[];
}
interface QQSongSimilar {
    action: {
        [key: string]: number;
    };
    aid: number;
    album: Album;
    bpm: number;
    data_type: number;
    es: string;
    file: File;
    fnote: number;
    genre: number;
    id: number;
    index_album: number;
    index_cd: number;
    interval: number;
    isonly: number;
    ksong: Ksong;
    label: string;
    language: number;
    mid: string;
    modify_stamp: number;
    mv: Mv;
    name: string;
    ov: number;
    pay: Pay;
    sa: number;
    singer: Singer[];
    status: number;
    subtitle: string;
    tid: number;
    time_public: Date;
    title: string;
    trace: string;
    type: number;
    url: string;
    version: number;
    volume: Volume;
}
interface Album {
    id: number;
    mid: string;
    name: string;
    pmid: string;
    subtitle: string;
    time_public: Date;
    title: string;
}
interface File {
    b_30s: number;
    e_30s: number;
    hires_bitdepth: number;
    hires_sample: number;
    media_mid: string;
    size_128mp3: number;
    size_192aac: number;
    size_192ogg: number;
    size_24aac: number;
    size_320mp3: number;
    size_48aac: number;
    size_96aac: number;
    size_96ogg: number;
    size_ape: number;
    size_dts: number;
    size_flac: number;
    size_hires: number;
    size_try: number;
    try_begin: number;
    try_end: number;
    url: string;
}
interface Ksong {
    id: number;
    mid: string;
}
interface Mv {
    id: number;
    name: string;
    title: string;
    vid: string;
    vt: number;
}
interface Pay {
    pay_down: number;
    pay_month: number;
    pay_play: number;
    pay_status: number;
    price_album: number;
    price_track: number;
    time_free: number;
}
interface Singer {
    id: number;
    mid: string;
    name: string;
    pmid: string;
    title: string;
    type: number;
    uin: number;
}
interface Volume {
    gain: number;
    lra: number;
    peak: number;
}
export {};
