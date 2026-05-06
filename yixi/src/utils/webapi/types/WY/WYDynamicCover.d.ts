export interface WYDynamicCoverRes {
    code: number;
    data: WYDynamicCoverData;
    message: string;
}
export interface WYDynamicCoverData {
    height: number;
    weight: number;
    needTransition: boolean;
    videoPlayUrl: string;
}
