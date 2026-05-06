export interface KGTopPlaylistResponse {
    data: KGTopPlaylistData;
    status: number;
    error_code: number;
}
export interface KGTopPlaylistData {
    has_next: number;
    bi_biz: string;
    session: string;
    alg_id: number;
    special_list: KGTopPlaylistItem[];
    OlexpIds: string;
    show_time: number;
    all_client_playlist_flag: number;
    refresh_time: number;
}
export interface KGTopPlaylistItem {
    sync: number;
    publishtime: Date;
    specialid: number;
    percount: number;
    list_info_trans_param: ListInfoTransParam;
    bz_status: number;
    singername: Singername;
    from: number;
    alg_path: AlgPath;
    tags: Tag[];
    ugc_talent_review: number;
    type: number;
    slid: number;
    flexible_cover: string;
    nickname: string;
    show: string;
    collectType: number;
    collectcount: number;
    trans_param: TransParam;
    report_info: string;
    specialname: string;
    imgurl: string;
    play_count: number;
    pic: string;
    from_hash: string;
    from_tag: number;
    global_collection_id: string;
    intro: string;
    suid: number;
    abtags?: Abtag[];
    recommendation?: string;
    ztc_info?: ZtcInfo[];
}
interface Abtag {
    name: string;
}
declare enum AlgPath {
    RecallFaiss = "recall:faiss",
    RecallSCIDSource = "recall:scid_source"
}
interface ListInfoTransParam {
    special_tag: number;
    trans_flag: number;
    skin?: Skin;
}
interface Skin {
    display_version_userids: DisplayVersionUserids;
    font_color: string;
    module_type: string;
    id: string;
    background_info_type: string;
    used_count: number;
    module_theme_info: ModuleThemeInfo;
    free_start: string;
    vip_type: number;
    resource_type: number;
    free_end: string;
    background_info: BackgroundInfo;
    title: string;
    status_bar_height: number;
    preview: Preview;
    thumbnail: string;
}
interface BackgroundInfo {
    color_info: ColorInfo;
    gradient_info: GradientInfo;
    blur_info: BlurInfo;
    image_info: ImageInfo;
}
interface BlurInfo {
    mask_color: string;
    radiu: number | null;
}
interface ColorInfo {
    color: string;
}
interface GradientInfo {
    mask_color: string;
    orientation: string;
    to_color: string;
    from_color: string;
}
interface ImageInfo {
    image_url: string;
}
interface DisplayVersionUserids {
    userids: Userids;
    version: Version;
}
interface Userids {
}
interface Version {
    android: AndroidElement[] | Userids;
    ios: AndroidElement[] | Userids;
}
interface AndroidElement {
    b: number;
    e: number;
}
interface ModuleThemeInfo {
    size: Size;
    md5: string;
    max_height_rate: string;
    url: string;
    images: Size[] | Userids;
    layout: string;
    num: number;
}
interface Size {
    width: number;
    height: number;
}
interface Preview {
    dynamic_url: string;
    static_url: string;
}
declare enum Singername {
    群星 = "\u7FA4\u661F"
}
interface Tag {
    tag_name: string;
    tag_id: number;
}
interface TransParam {
    special_tag: number;
}
interface ZtcInfo {
    mixsongid: number;
    logo_style: number;
    ztc_mark: string;
}
export {};
