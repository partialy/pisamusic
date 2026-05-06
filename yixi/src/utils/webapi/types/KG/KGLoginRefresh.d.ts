export interface KGLoginRefreshResponse {
    data: KGLoginRefreshData;
    status: number;
    error_code: number;
}
export interface KGLoginRefreshData {
    is_vip: number;
    servertime: Date;
    roam_type: number;
    t1: string;
    reg_time: Date;
    vip_type: number;
    birthday_mmdd: string;
    expire_time: Date;
    userid: number;
    listen_end_time: string;
    su_vip_end_time: Date;
    su_vip_y_endtime: string;
    user_type: number;
    username: string;
    qq: number;
    exp: number;
    m_end_time: Date;
    score: number;
    bookvip_valid: number;
    bookvip_end_time: Date;
    arttoy_avatar: string;
    totp_server_timestamp: number;
    roam_end_time: string;
    secu_params: string;
    su_vip_begin_time: Date;
    roam_begin_time: string;
    vip_end_time: Date;
    sex: number;
    listen_type: number;
    vip_token: string;
    nickname: string;
    mobile: number;
    y_type: number;
    m_type: number;
    listen_begin_time: string;
    bc_code: string;
    su_vip_clearday: string;
    roam_list: RoamList;
    user_y_type: number;
    pic: string;
    m_begin_time: Date;
    t_expire_time: number;
    vip_begin_time: Date;
    birthday: Date;
    m_is_old: number;
    wechat: number;
    token: string;
}
interface RoamList {
}
export {};
