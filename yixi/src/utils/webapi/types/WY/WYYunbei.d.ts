export interface WYYunbeiResponse {
    data: WYYunbeiData;
    code: number;
}
export interface WYYunbeiData {
    days: number;
    shells: number;
}
export interface WYYunbeiInfoResponse {
    level: number;
    userPoint: UserPoint;
    mobileSign: boolean;
    pcSign: boolean;
    viptype: number;
    expiretime: number;
    backupExpireTime: number;
    storeTitle: string;
    pubwords: string;
    gameConfig: null;
    ringConfig: null;
    fmConfig: null;
    ticketConfig: TicketConfig;
    code: number;
}
interface TicketConfig {
    content: string;
    picId: string;
    picUrl: string;
}
interface UserPoint {
    balance: number;
    blockBalance: number;
    status: number;
    updateTime: number;
    userId: number;
    version: number;
}
export interface WYYunbeiSignResponse {
    code: number;
    data: SignData;
    message: string;
}
interface SignData {
    sign: boolean;
}
export interface WYYunbeiTodayResponse {
    data: {
        shells: 0;
    };
    code: 200;
}
export {};
