export interface KGUserVipDetailResponse {
    data: KGUserVipDetailData;
    status: number;
    error_code: number;
}
export interface KGUserVipDetailData {
    is_vip: number;
    roam_type: number;
    m_reset_time: Date;
    m_y_endtime: Date;
    vip_clearday: Date;
    vip_type: number;
    vip_begin_time: Date;
    roam_begin_time: string;
    vip_end_time: Date;
    userid: number;
    vip_y_endtime: Date;
    m_clearday: Date;
    svip_level: number;
    svip_score: number;
    su_vip_clearday: string;
    su_vip_end_time: Date;
    su_vip_y_endtime: string;
    su_vip_begin_time: Date;
    busi_vip: BusiVip[];
    m_begin_time: Date;
    user_y_type: number;
    user_type: number;
    y_type: number;
    m_end_time: Date;
    roam_end_time: string;
    m_is_old: number;
    m_type: number;
}
interface BusiVip {
    is_vip: number;
    purchased_ios_type: number;
    purchased_type: number;
    is_paid_vip: number;
    vip_clearday: string;
    latest_product_id: string;
    product_type: string;
    vip_begin_time: Date;
    y_type: number;
    vip_end_time: Date;
    userid: number;
    vip_limit_quota: VipLimitQuota;
    paid_vip_expire_time: string;
    busi_type: string;
    tvip_remain_second?: number;
}
interface VipLimitQuota {
    total?: number;
}
export {};
