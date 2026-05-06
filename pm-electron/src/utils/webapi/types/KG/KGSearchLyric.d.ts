export interface KGSearchhLyricResponse {
    status: number;
    info: string;
    errcode: number;
    errmsg: string;
    keyword: string;
    proposal: string;
    has_complete_right: number;
    companys: string;
    ugc: number;
    ugccount: number;
    expire: number;
    candidates: KGSearchhLyricCandidate[];
    ugccandidates: any[];
    artists: Artist[];
    ai_candidates: any[];
}
interface Artist {
    identity: number;
    base: Base;
}
interface Base {
    author_id: number;
    author_name: string;
    is_publish: number;
    avatar: string;
    identity: number;
    type: number;
    country?: string;
    language?: Language;
    birthday?: Date;
}
declare enum Language {
    欧美 = "\u6B27\u7F8E"
}
export interface KGSearchhLyricCandidate {
    id: string;
    product_from: string;
    accesskey: string;
    can_score: boolean;
    singer: string;
    song: string;
    duration: number;
    uid: string;
    nickname: string;
    origiuid: string;
    transuid: string;
    sounduid: string;
    originame: string;
    transname: string;
    soundname: string;
    parinfo: any[];
    parinfoExt: any[];
    language: string;
    krctype: number;
    hitlayer: number;
    hitcasemask: number;
    adjust: number;
    score: number;
    contenttype: number;
    content_format: number;
    download_id: string;
}
export interface KGLyricResponse {
    status: number;
    info: string;
    error_code: number;
    fmt: string;
    contenttype: number;
    _source: string;
    charset: string;
    content: string;
    id: string;
    decodeContent: string;
}
export {};
