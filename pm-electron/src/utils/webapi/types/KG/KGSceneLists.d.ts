export interface KGSceneListResponse {
    data: KGSceneListData;
    errcode: number;
    status: number;
    error: string;
}
export interface KGSceneListData {
    timestamp: number;
    is_scene_grey_user: boolean;
    list: KGSceneListItem[];
}
export interface KGSceneListItem {
    label: string;
    is_publish: number;
    music_tag: MusicTag;
    sort: number;
    title_pic: string;
    intro: Intro;
    popup: string;
    icon: string;
    scene_type: number;
    title: string;
    color: string;
    bg_pic: string;
    pic: string;
    extra: Extra;
    module_list: ModuleList[];
    scene_id: number;
}
interface Extra {
    song_count: number;
    view_num: number;
}
declare enum Intro {
    Empty = "",
    医学支持广州医科大学附属第三医院生殖医学中心音乐处方由鲁新华工作室提供 = "\u533B\u5B66\u652F\u6301\uFF1A\u5E7F\u5DDE\u533B\u79D1\u5927\u5B66\u9644\u5C5E\u7B2C\u4E09\u533B\u9662\u751F\u6B96\u533B\u5B66\u4E2D\u5FC3\uFF1B\u97F3\u4E50\u5904\u65B9\uFF1A\u7531\u9C81\u65B0\u534E\u5DE5\u4F5C\u5BA4\u63D0\u4F9B"
}
interface ModuleList {
    is_publish: number;
    module_type: number;
    module_style: number;
    is_show: number;
    module_label: string;
    need_login: number;
    module_title: string;
    module_sort: number;
    module_id: number;
    module_intro: string;
    module_abtest: string;
}
interface MusicTag {
    module_id: number;
    module_sort: number;
    module_extra: ModuleExtra[];
}
interface ModuleExtra {
    quku_tag_id: number;
    sort: number;
    tag_name: string;
    pic: string;
    play_order: number;
    abtest: string;
    tag_id: number;
    content_type: number;
    select_tag: number;
}
export {};
