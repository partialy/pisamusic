export interface KGUserPlaylistResponse {
    data: KGUserPlaylistData;
    status: number;
    error_code: number;
}
export interface KGUserPlaylistData {
    info: Array<KGUserPlaylistItem>;
    phone_flag: number;
    total_ver: number;
    userid: number;
    album_count: number;
    list_count: number;
    collect_count: number;
}
interface KGUserPlaylistItem {
    tags?: any;
    status: number;
    create_user_pic: string;
    per_num: number;
    pub_new: number;
    is_drop: number;
    list_create_userid: number;
    is_publish: number;
    musiclib_tags?: Array<any>;
    pub_time: number;
    name: string;
    is_featured: number;
    list_ver: number;
    intro?: any;
    type: number;
    list_create_listid: number;
    radio_id: number;
    source: number;
    is_del: number;
    m_count: number;
    create_time: number;
    kq_talent: number;
    is_edit: number;
    update_time: number;
    per_count: number;
    sound_quality?: any;
    sort: number;
    is_mine: number;
    is_def: number;
    list_create_gid: string;
    global_collection_id: string;
    is_per: number;
    pic: string;
    list_create_username: string;
    is_pri: number;
    is_custom_pic: number;
    listid: number;
    pub_type: number;
    count: number;
}
export {};
