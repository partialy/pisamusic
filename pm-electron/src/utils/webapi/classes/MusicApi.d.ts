import { AxiosInstance, AxiosRequestConfig } from "axios";
export interface MusicApiType {
    setAuthKey(authKey: string): void;
    setBaseURL(baseURL: string): void;
    setExtensionUrl(extensionUrl: string): void;
    getAuthKey(): string;
    getBaseURL(): string;
    getExstensionUrl(): string;
    fetchData<T>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T>;
}
export default class MusicApi implements MusicApiType {
    private authKey;
    private baseURL;
    private originUrl;
    private backupUrl;
    private currentUrlIndex;
    private extensionUrl;
    private customHeaders;
    private request;
    protected retryCount: number;
    constructor(options: {
        baseURL: string;
        extensionUrl?: string;
        backupUrl?: string[];
        retryCount?: number;
        authKey?: string;
    });
    getRequest(): AxiosInstance;
    getStruct(): {
        authKey: string;
        backupUrl: string[];
        retryCount: number;
        extensionUrl: string;
    };
    setAuthKey(authKey: string): void;
    setBaseURL(baseURL: string): void;
    setExtensionUrl(extensionUrl: string): void;
    setHeaders(headers: Record<string, string>): void;
    getHeaders(): Record<string, string>;
    getAuthKey(): string;
    getBaseURL(): string;
    getExstensionUrl(): string;
    /**
     * 默认GET，参数为query
     * @param url 路径
     * @param params 参数，POST时候自动添加到body
     * @param config request配置
     * @returns T
     */
    fetchData<T>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T>;
    switchUrl(main?: boolean): string;
}
