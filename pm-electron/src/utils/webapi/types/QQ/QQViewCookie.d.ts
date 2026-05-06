export interface QQViewCookieResponse {
    result: number;
    data: QQViewCookieData;
}
interface QQViewCookieData {
    pgv_pvid: string;
    Path: string;
    Expires: string;
    fqm_pvqid: string;
    fqm_sessionid: string;
    pgv_info: string;
    ts_last: string;
    ts_refer: string;
    ts_uid: string;
    _qpsvr_localtk: string;
    RK: string;
    ptcz: string;
    login_type: string;
    psrf_qqopenid: string;
    tmeLoginType: string;
    psrf_qqrefresh_token: string;
    psrf_access_token_expiresAt: string;
    psrf_qqaccess_token: string;
    psrf_musickey_createtime: string;
    wxunionid: string;
    psrf_qqunionid: string;
    qm_keyst: string;
    qqmusic_key: string;
    wxopenid: string;
    music_ignore_pskey: string;
    euin: string;
    wxrefresh_token: string;
    uin: string;
}
export {};
