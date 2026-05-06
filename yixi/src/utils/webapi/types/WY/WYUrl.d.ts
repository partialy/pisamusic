export interface WYUrlResponse {
    code: number;
    data: Array<WYUrlData>;
}
export interface WYUrlData {
    id: number;
    url: string;
    br: number;
    size: number;
    md5: string;
    code: number;
    expi: number;
    type: string;
    gain: number;
    peak: number;
    closedGain: number;
    closedPeak: number;
    fee: number;
    uf?: any;
    payed: number;
    flag: number;
    canExtend: boolean;
    freeTrialInfo?: any;
    level: string;
    encodeType: string;
    channelLayout?: any;
    freeTrialPrivilege: FreeTrialPrivilege;
    freeTimeTrialPrivilege: FreeTimeTrialPrivilege;
    urlSource: number;
    rightSource: number;
    podcastCtrp?: any;
    effectTypes?: any;
    time: number;
    message?: any;
    levelConfuse?: any;
    musicId: string;
    accompany?: any;
    sr: number;
    auEff?: any;
}
interface FreeTrialPrivilege {
    resConsumable: boolean;
    userConsumable: boolean;
    listenType?: any;
    cannotListenReason?: any;
    playReason?: any;
    freeLimitTagType?: any;
}
interface FreeTimeTrialPrivilege {
    resConsumable: boolean;
    userConsumable: boolean;
    type: number;
    remainTime: number;
}
export {};
