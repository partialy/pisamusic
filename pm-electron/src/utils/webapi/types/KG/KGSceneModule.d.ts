export interface KGSceneModuleResponse {
    data: KGSceneModuleData;
    errcode: number;
    status: number;
    error: string;
}
export interface KGSceneModuleData {
    timestamp: number;
    is_scene_grey_user: boolean;
    content: KGSceneModuleContent;
}
export interface KGSceneModuleContent {
    match_tag_info: null;
    match_content_info: any[];
    discuss: Discuss[];
    match_type: number;
    music_station: MusicStation;
    info: Info;
    music: Music[];
    match_tag_id: number;
    top_info: TopInfo;
    banner: any[];
    select_tag: any[];
    match_module_id: number;
}
interface Discuss {
    tab: any[];
    abtest: string;
    mini_programs: any[];
    module_id: number;
    line: number;
    label: string;
    module_type: number;
    sort: number;
    module_style: number;
    bottom_line: number;
    parent_module_id: number;
    title: string;
    need_login: number;
    personal_recommend: number;
    display_area: number;
    collection: any[];
    extra: DiscussExtra;
    intro: string;
    scene_id: number;
}
interface DiscussExtra {
    discuss_param: string;
}
interface Info {
    play_tag_type: number;
    play_tag_id: number;
    icon: string;
    play_quku_tag_id: number;
    bg_pic: string;
    title_pic: string;
    label: string;
    is_publish: number;
    search_tag_id: number;
    sort: number;
    search_module_id: number;
    search_tag_type: number;
    search_quku_tag_id: number;
    title: string;
    color: string;
    popup: string;
    pic: string;
    extra: InfoExtra;
    intro: string;
    scene_id: number;
}
interface InfoExtra {
    song_count: number;
    view_num: number;
}
interface Music {
    tab: Tab[];
    abtest: string;
    mini_programs: any[];
    module_id: number;
    line: number;
    label: string;
    module_type: number;
    sort: number;
    module_style: number;
    bottom_line: number;
    parent_module_id: number;
    title: string;
    need_login: number;
    personal_recommend: number;
    display_area: number;
    collection: any[];
    extra: ExtraElement[];
    intro: string;
    scene_id: number;
}
interface ExtraElement {
    quku_tag_id: number;
    types?: number;
    sort: number;
    tag_name: string;
    abtest: string;
    pic: string;
    cat_name?: CatName;
    select_tag: number;
    play_order: number;
    tag_id: number;
    content_type: number;
    cat_sort?: number;
}
declare enum CatName {
    其他 = "\u5176\u4ED6"
}
interface Tab {
    tab_id: number;
    abtest: string;
    sort: number;
    tab_name: string;
    content_type: number;
    origin_tab_name: string;
}
interface MusicStation {
    ip_id: number;
    userid: number;
}
interface TopInfo {
    link: string;
    sub_title: string;
    icon: string;
    animate_link: string;
}
export {};
