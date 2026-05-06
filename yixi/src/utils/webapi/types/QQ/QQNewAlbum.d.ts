export interface QQNewAlbumResponse {
    result: number;
    data: QQNewAlbumData;
}
export interface QQNewAlbumData {
    list: QQNewAlbum[];
    type: number;
    typeName: string;
}
export interface QQNewAlbum {
    id: number;
    mid: string;
    name: string;
    trans_name: string;
    singers: QQNewAlbumSinger[];
    type: number;
    language: number;
    genre: number;
    area: number;
    movie: string;
    release_time: Date;
    company: Company;
    status: number;
    index: string;
    tag: string;
    pay: Pay;
    ex: ListEx;
    photo: ListPhoto;
    tmetags: string;
    ex_status: number;
    show_com_new: number;
    companyshow: Company;
    modify_time: string;
    str_genre: string;
    album_right: number;
    Fpay_control: number;
    cd_album_id: string;
    mini_album_id: string;
    data: ListData;
    album_wiki: string;
    vip_play_conf: VipPlayConf;
    album_ori_name: string;
    singers_with_anonymous: any[];
    other_name: string;
    mv_ids: string;
    vids: string;
    head_magic_color: string;
}
interface Company {
    id: number;
    name: string;
    ex: CompanyEx;
}
interface CompanyEx {
    desc: string;
    company_photo: number;
}
interface ListData {
    int2: number;
    int3: number;
    update_time: string;
    int4: number;
    int0: number;
    str0: string;
    str1: string;
    str2: string;
}
interface ListEx {
    desc: string;
    track_nums: number;
    playable_track_nums: number;
    album_tag3: number;
    singer_tag: string;
    album_tag5: string;
    schedule_status: number;
    long_audio_nums: number;
    caliber: number;
    recommend_reason: string;
    short_recommend_reason: string;
    lr_book_id: number;
    lr_tag: string;
    status: number;
    has_special_fnote: number;
}
interface Pay {
    payment_total: number;
    payment_album_type: number;
    payment_discount: number;
    payment_discount_beg: number;
    payment_discount_end: number;
    payment_beg: string;
    payment_end: string;
    pre_sale_beg: string;
    str_payment_discount_beg: string;
    str_payment_discount_end: string;
}
interface ListPhoto {
    gaus_pic: string;
    has_photo: number;
    pic_mid: string;
    vip_flag: number;
    pay_flag: number;
    version: number;
    primecolor: number;
    magic_class: number;
    magic_color: number;
    src_w: number;
    src_h: number;
}
export interface QQNewAlbumSinger {
    id: number;
    mid: string;
    name: string;
    foreign_name: string;
    type: number;
    genre: number;
    area: number;
    company: Company;
    grade: number;
    origin: number;
    enter: number;
    country: number;
    identity: number;
    birthday: string;
    instrument: number;
    ex: SingerEx;
    photo: SingerPhoto;
    opt_grade: number;
    status: number;
    opt_grade_new: number;
    vertical_type: string;
    singer_wiki: string;
    index: string;
    is_classical: number;
}
interface SingerEx {
    desc: string;
    wiki: string;
    tag: string;
    ex_status: number;
    ex_identity: number;
    info_name: string;
    name_spell: string;
    band: string;
    dieDate: string;
    force_show: number;
    auth_status: number;
    control: number;
}
interface SingerPhoto {
    has_photo: number;
    photo_cnt: number;
    big_photo_flag: string;
    magic_rgb: number;
    pic1_flag: number;
    pic2_flag: number;
    pic_mid: string;
}
interface VipPlayConf {
    start_time: string;
    fnote: number;
    status: number;
}
export {};
