export interface KGSceneModuleInfoResponse {
    data: KGSceneModuleInfoData;
    errcode: number;
    status: number;
    error: string;
}
export interface KGSceneModuleInfoData {
    timestamp: number;
    info: KGSceneModuleInfoItem;
}
export interface KGSceneModuleInfoItem {
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
    need_login: number;
    personal_recommend: number;
    title: string;
    collection: any[];
    extra: Extra[];
    intro: string;
    scene_id: number;
}
interface Extra {
    quku_tag_id: number;
    sort: number;
    tag_name: string;
    pic: string;
    abtest: string;
    select_tag: number;
    tag_id: number;
    content_type: number;
    play_order: number;
}
export {};
