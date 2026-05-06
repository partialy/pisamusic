export interface WYQRCodeResponse {
    data: {
        code: number;
        unikey: string;
    };
    code: number;
}
export interface WYQRCodeCreateResponse {
    code: number;
    data: {
        qrurl: string;
        qrimg: string;
    };
}
export interface WYQRCodeCheckResponse {
    code: number;
    message: string;
    cookie: string;
}
