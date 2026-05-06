import MusicApi from "./MusicApi";
import { KWSearchResponse } from "../types/KW/KWSearch";
import { KWUrlResponse } from "../types/KW/KWUrl";
export declare class KWAPI extends MusicApi {
    search(params: {
        keywords: string;
        page?: number;
        pagesize?: number;
    }): Promise<KWSearchResponse>;
    url(params: {
        id: string;
        quality?: "standard" | "exhigh" | "lossless" | "hires";
    }): Promise<KWUrlResponse>;
}
