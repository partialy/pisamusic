export interface QQSongListResponse {
    result: number;
    data: QQSongListData;
}
export interface QQSongListData {
    disstid: string;
    dir_show: number;
    owndir: number;
    dirid: number;
    coveradurl: string;
    dissid: number;
    login: string;
    uin: string;
    encrypt_uin: string;
    dissname: string;
    logo: string;
    pic_mid: string;
    album_pic_mid: string;
    pic_dpi: number;
    isAd: number;
    desc: string;
    ctime: number;
    mtime: number;
    headurl: string;
    ifpicurl: string;
    nick: string;
    nickname: string;
    type: number;
    singerid: number;
    singermid: string;
    isvip: number;
    isdj: number;
    tags: any[];
    songnum: number;
    songids: string;
    songtypes: string;
    disstype: number;
    dir_pic_url2: string;
    song_update_time: number;
    song_update_num: number;
    total_song_num: number;
    song_begin: number;
    cur_song_num: number;
    songlist: QQSongListSong[];
    visitnum: number;
    cmtnum: number;
    buynum: number;
    scoreavage: string;
    scoreusercount: number;
}
export interface QQSongListSong {
    albumdesc: Albumdesc;
    albumid: number;
    albummid: string;
    albumname: string;
    alertid: number;
    belongCD: number;
    cdIdx: number;
    interval: number;
    isonly: number;
    label: string;
    msgid: number;
    pay: Pay;
    preview: Preview;
    rate: number;
    singer: Singer[];
    size128: number;
    size320: number;
    size5_1: number;
    sizeape: number;
    sizeflac: number;
    sizeogg: number;
    songid: number;
    songmid: string;
    songname: string;
    songorig: string;
    songtype: number;
    strMediaMid: string;
    stream: number;
    switch: number;
    type: number;
    vid: string;
}
declare enum Albumdesc {
    Empty = "",
    爱杀17电视剧片尾曲 = "\u300A\u7231\u674017\u300B\u7535\u89C6\u5267\u7247\u5C3E\u66F2",
    神话电影主题曲 = "\u300A\u795E\u8BDD\u300B\u7535\u5F71\u4E3B\u9898\u66F2",
    精武飞鸿电视剧主题曲 = "\u300A\u7CBE\u6B66\u98DE\u9E3F\u300B\u7535\u89C6\u5267\u4E3B\u9898\u66F2"
}
interface Pay {
    payalbum: number;
    payalbumprice: number;
    paydownload: number;
    payinfo: number;
    payplay: number;
    paytrackmouth: number;
    paytrackprice: number;
    timefree: number;
}
interface Preview {
    trybegin: number;
    tryend: number;
    trysize: number;
}
interface Singer {
    id: number;
    mid: string;
    name: string;
}
export {};
