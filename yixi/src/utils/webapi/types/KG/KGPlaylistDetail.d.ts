export interface KGPlaylistDetailResponse {
    data: KGPlaylistDetailData[];
    status: number;
    error_code: number;
}
export interface KGPlaylistDetailData {
    tags: string;
    status: number;
    create_user_pic: string;
    is_pri: number;
    pub_new: number;
    is_drop: number;
    list_create_userid: number;
    is_publish: number;
    musiclib_tags: MusiclibTag[];
    pub_type: number;
    is_featured: number;
    publish_date: Date;
    collect_total: number;
    list_ver: number;
    intro: string;
    type: number;
    list_create_listid: number;
    specialid: number;
    radio_id: number;
    source: number;
    sound: Sound;
    listid: number;
    is_def: number;
    parent_global_collection_id: string;
    sound_quality: string;
    per_count: number;
    plist: any[];
    kq_talent: number;
    create_time: number;
    is_per: number;
    is_edit: number;
    update_time: number;
    code: number;
    count: number;
    sort: number;
    is_mine: number;
    musiclib_id: number;
    per_num: number;
    create_user_gender: number;
    number: number;
    pic: string;
    list_create_username: string;
    name: string;
    is_custom_pic: number;
    global_collection_id: string;
    heat: number;
    list_create_gid: string;
}
interface MusiclibTag {
    tag_id: number;
    parent_id: number;
    tag_name: string;
}
interface Sound {
    id: string;
    type: number;
    args: string;
}
export {};
