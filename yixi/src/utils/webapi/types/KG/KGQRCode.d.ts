export interface KGQRCodeKeyResponse {
    data: {
        qrcode: string;
        qrcode_img: string;
    };
    status: number;
    error_code: number;
}
export interface KGQRCodeImageResponse {
    code: number;
    data: {
        url: string;
        base64: string;
    };
}
export interface KGQRCodeCheckResponse {
    data: {
        status: 1 | 2 | 4;
        nickname?: string;
        pic?: string;
        token?: string;
        userid?: 760768723;
    };
    status: 1;
    error_code: 0;
}
