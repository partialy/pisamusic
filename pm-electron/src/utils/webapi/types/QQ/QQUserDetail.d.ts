export interface QQUserDetailResponse {
    code: number;
    subcode: number;
    msg: string;
    data: QQUserDetailData;
    result: number;
}
export interface QQUserDetailData {
    creator: Creator;
    mymusictype: string;
    mymusic: QQUserDetailMymusic[];
    mydiss: QQUserDetailMydiss;
    video: QQUserDetailMydiss;
    myarticle: QQUserDetailMyarticle;
    myradio: QQUserDetailMyarticle;
}
interface Creator {
    nick: string;
    headpic: string;
    ifpic: string;
    uin: number;
    forbidden: number;
    ishost: number;
    is_bind_weibo: number;
    weibo_uid: string;
    weibo_nick: string;
    extra: string;
    singerinfo: Singerinfo;
    uin_web: string;
    encrypt_uin: string;
    isfollow: number;
    islock: number;
    buy_lock: number;
    fav_lock: number;
    diss_lock: number;
    shareurl: string;
    share_bykey: Bykey;
    jumpkey: string;
    typeinfo: Typeinfo;
    lvinfo: Info[];
    userInfoUI: UserInfoUI;
    medal: Medal;
    listeninfo: Info;
    backpic: Backpic;
    cfinfo: Cfinfo;
    nums: Nums;
}
interface Backpic {
    picurl: string;
    type: number;
    title: string;
}
interface Cfinfo {
    title: string;
    jumpurl: string;
    jumpkey: string;
    cfinfo_bykey: Bykey;
    similar: number;
}
interface Bykey {
    url_key: string;
    url_params: string;
}
interface Info {
    iconurl: string;
    jumpurl: string;
    jumpkey: string;
    listen_bykey?: Bykey;
    lvinfo_bykey?: Bykey;
}
interface Medal {
    flag: number;
    iconurl: string;
    jumpurl: string;
    jumpkey: string;
    medal_bykey: Bykey;
}
interface Nums {
    visitornum: number;
    fansnum: number;
    follownum: number;
    followusernum: number;
    followsingernum: number;
    frdnum: number;
}
interface Singerinfo {
    singerid: number;
}
interface Typeinfo {
    type: number;
    jumpurl: string;
    cfinfo_bykey: Bykey;
    jumpkey: string;
    iconurl: string;
}
interface UserInfoUI {
    nickname: Nickname;
    iconlist: Iconlist[];
}
interface Iconlist {
    width: number;
    height: number;
    srcUrl: string;
    style: string;
    ext: string;
    desc: string;
}
interface Nickname {
    lightColor: string;
    darkColor: string;
}
export interface QQUserDetailMyarticle {
    title: string;
    jumpurl: string;
    jumpkey: string;
    laypic: string;
    totalcnt: number;
    list: any[];
}
export interface QQUserDetailMydiss {
    num: number;
    title: string;
    laypic?: string;
    jumpurl: string;
    list: List[];
    jumpkey?: string;
}
interface List {
    dissid: number;
    dirid: number;
    picurl: string;
    title: string;
    subtitle: string;
    icontype: number;
    iconurl: string;
    isshow: number;
    dir_show: number;
}
export interface QQUserDetailMymusic {
    title: string;
    picurl: string;
    laypic: string;
    subtitle: string;
    jumpurl: string;
    jumptype: number;
    jumpkey: string;
    id: string;
    music_bykey: Bykey;
    type: number;
    num0: number;
    num1: number;
    num2: number;
}
export {};
