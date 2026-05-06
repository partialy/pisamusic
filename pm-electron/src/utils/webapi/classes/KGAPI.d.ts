import MusicApi from "./MusicApi";
import { KGLoginRefreshResponse } from "../types/KG/KGLoginRefresh";
import { KGPlaylistResponse } from "../types/KG/KGPlaylist";
import { KGPlaylistDetailResponse } from "../types/KG/KGPlaylistDetail";
import { KGPlaylistSimilarResponse } from "../types/KG/KGPlaylistSimilar";
import { KGPlaylistTagsResponse } from "../types/KG/KGPlaylistTags";
import { KGQRCodeCheckResponse, KGQRCodeImageResponse, KGQRCodeKeyResponse } from "../types/KG/KGQRCode";
import { KGSearchResponse } from "../types/KG/KGSearch";
import { KGSearchHotResponse } from "../types/KG/KGSearchHot";
import { KGLyricResponse, KGSearchhLyricResponse } from "../types/KG/KGSearchLyric";
import { KGSearchSuggestResponse } from "../types/KG/KGSearchSuggest";
import { KGSceneListResponse } from "../types/KG/KGSceneLists";
import { KGTopCardResponse } from "../types/KG/KGTopCard";
import { KGTopPlaylistResponse } from "../types/KG/KGTopPlaylist";
import { KGTopSongResponse } from "../types/KG/KGTopSong";
import { KGUrlResponse } from "../types/KG/KGUrl";
import { KGUserPlaylistResponse } from "../types/KG/KGUserPlaylist";
import { KGLyricParams, KGSearchParams, KGUrlParams } from "../types/Params/KGParams";
import { KGScenePlaylistResponse } from "../types/KG/KGScenePlaylist";
import { KGSceneModuleResponse } from "../types/KG/KGSceneModule";
import { KGSceneModuleInfoResponse } from "../types/KG/KGSceneModuleInfo";
import { KGEveryDayRecommendResponse } from "../types/KG/KGEveryDayRecommend";
import { KGUserDetailResponse } from "../types/KG/KGUserDetails";
import { KGUserVipDetailResponse } from "../types/KG/KGUserVipDetail";
import { KGUserCloudResponse, KGUserCloudUrlResponse } from "../types/KG/KGUserCloud";
import { KGLoginResponse } from "../types/KG/KGLoginResponse";
interface TokenCookie {
    KUGOU_API_PLATFORM: string | undefined;
    token: string;
    userid: number;
    vip_type: number;
    vip_token: string;
}
export declare class KGAPI extends MusicApi {
    protected tokenCookie: TokenCookie;
    protected tokenCookieString: string[];
    setLocalCookie(tokenCookie: string): void;
    /**
     * 刷新token并存储到tokenCookie
     * @param cb 登录成功回调,参数为登录成功返回的cookie
     */
    refreshToken(cb?: (cookie: KGLoginRefreshResponse) => void): Promise<KGLoginRefreshResponse>;
    /**
     * 获取用户额外信息
     * 说明：登陆后调用此接口，可以获取用户额外信息
     * 接口地址： /user/detail
     * @returns 用户信息
     */
    userDetail(): Promise<KGUserDetailResponse>;
    /**
     * 获取用户 vip 信息
     * 说明：登陆后调用此接口，可以获取用户 vip 信息
     * 接口地址： /user/vip/detail
     * @returns 用户vip信息
     */
    userVipDetail(): Promise<KGUserVipDetailResponse>;
    /**
     * 获取用户云盘音乐
     * @param param:{ page: number, pagesize: number }
     * @returns
     */
    userCloud(param?: {
        page: number;
        pagesize: number;
    }): Promise<KGUserCloudResponse>;
    /**
     * 获取用户云盘音乐url
     * @param param : { hash: string }
     * @returns
     */
    userCloudUrl(param: {
        hash: string;
    }): Promise<KGUserCloudUrlResponse>;
    /**
     * 获取验证码
     * @param param : { mobile: string }
     * @returns
     */
    sendCode(param: {
        mobile: string;
    }): Promise<{
        data: {
            count: 9;
        };
        status: 1;
        error_code: 0;
    }>;
    /**
     * 登录
     * @param param : { mobile: string, code: string }
     * @returns
     */
    loginCellphone(param: {
        mobile: string;
        code: string;
    }): Promise<KGLoginResponse>;
    /**
     * 获取二维码登录密钥
     */
    qrCodeKey(): Promise<KGQRCodeKeyResponse>;
    /**
     * 创建二维码
     * @param key QRCOde key
     */
    qrCodeCreate(key: string): Promise<KGQRCodeImageResponse>;
    /**
     * 检查二维码登录状态
     * @param key QRCOde key
     */
    qrCodeCheck(key: string): Promise<KGQRCodeCheckResponse>;
    /**
     *
     * @param params 刷新参数
     * @returns KGLoginRefreshResponse
     */
    loginRefresh(params: {
        token?: string;
        userId?: number;
    }): Promise<KGLoginRefreshResponse>;
    /**
     * 搜索音乐
     * @param searchParams 搜索参数
     * @returns 搜索响应结果
     */
    search(searchParams: KGSearchParams): Promise<KGSearchResponse>;
    /**
     * 获取歌曲播放URL
     * @param urlParams URL参数
     * @returns 歌曲URL响应结果
     */
    url(urlParams: KGUrlParams): Promise<KGUrlResponse>;
    /**
     * 热搜列表
     * 说明：调用此接口，可获取热门搜索列表
     * 接口地址：/search/hot
     * @returns 热搜列表
     * @example /search/hot
     */
    searchHot(): Promise<KGSearchHotResponse>;
    /**
     * 搜索建议
     * 说明：传入搜索关键词可获得搜索建议，搜索结果包含单曲、歌手、歌单信息
     * 可选参数：
     * - albumTipCount：专辑返回数量
     * - correctTipCount：目前未知，可能是歌单
     * - mvTipCount：MV 返回数量
     * - musicTipCount：音乐返回数量
     * 接口地址：/search/suggest
     * @param keywords 搜索关键词
     * @param options 可选参数
     * @returns 搜索建议结果
     * @example /search/suggest?keywords=海阔天空
     */
    searchSuggest(keywords: string, options?: {
        albumTipCount?: number;
        correctTipCount?: number;
        mvTipCount?: number;
        musicTipCount?: number;
    }): Promise<KGSearchSuggestResponse>;
    /**
     * 歌单分类
     * 说明：获取歌单分类，包含 category 信息
     * 接口地址：/playlist/tags
     * @returns 歌单分类列表
     * @example /playlist/tags
     */
    playlistTags(): Promise<KGPlaylistTagsResponse>;
    /**
     * 获取用户歌单列表
     * @returns 用户歌单响应结果
     */
    userPlayList(): Promise<KGUserPlaylistResponse>;
    /**
     * 歌单
     * 说明：可获取歌单
     * 必选参数：
     * - category_id：tag，0：推荐，11292：HI-RES，其他可从 /playlist/tags 接口获取（返回中的 tag_id 为 category_id）
     * 可选参数：
     * - withsong：是否返回歌曲列表（不全），0：不返回，1：返回
     * - withtag：是否返回歌单分类，0：不返回，1：返回
     * 接口地址：/top/playlist
     * @param params { category_id, withsong?, withtag? }
     * @returns 歌单列表
     * @example /top/playlist?category_id=0
     */
    topPlaylist(params: {
        category_id: number | string;
        withsong?: number | boolean;
        withtag?: number | boolean;
        page?: number;
    }): Promise<KGTopPlaylistResponse>;
    /**
     * 获取歌单详情
     * 说明：调用此接口，可获取歌单详细信息
     * 必选参数：
     * - ids：歌单中的 global_collection_id，可以传多个，用逗号分隔
     * 接口地址：/playlist/detail
     * @param ids 歌单ID数组（global_collection_id）
     * @returns 歌单详情响应结果
     * @example /playlist/detail?ids=collection_3_1863870844_4_0
     * @example /playlist/detail?ids=collection_3_1863870844_4_0,collection_3_2093906551_8_0
     */
    playListDetail(ids: string[]): Promise<KGPlaylistDetailResponse>;
    /**
     * 获取歌单中的所有歌曲
     * 说明：传入对应的歌单 global_collection_id，即可获得对应的所有歌曲
     * 必选参数：
     * - id：歌单中的 global_collection_id
     * 可选参数：
     * - page：页数
     * - pagesize：每页条数，默认为 30
     * 接口地址：/playlist/track/all
     * @param id 歌单ID（global_collection_id）
     * @returns 歌单歌曲响应结果
     * @example /playlist/track/all?id=collection_3_1863870844_4_0
     */
    playListTracks(p: {
        id: string;
        page?: number;
        pagesize?: number;
    }): Promise<KGPlaylistResponse>;
    /**
     * 相似歌单
     * 说明：根据歌单 id（global_collection_id）获取相似歌单，支持多个以逗号分隔
     * 必选参数：
     * - ids：歌单 global_collection_id，支持多个
     * 接口地址：/playlist/similar
     * @param ids 歌单ID数组（global_collection_id），可传多个
     * @returns 相似歌单响应结果
     * @example /playlist/similar?ids=collection_1_1341266283_964007_0
     * @example /playlist/similar?ids=collection_1_1341266283_964007_0,collection_3_1041185112_11_0
     */
    playListSimilar(ids: string[]): Promise<KGPlaylistSimilarResponse>;
    /**
     * 歌曲推荐
     * 说明：获取歌曲推荐
     * 必选参数：
     * - card_id：1：精选好歌随心听/私人专属好歌，2：经典怀旧金曲，3：热门好歌精选，4：小众宝藏佳作，5：未知，6：VIP 专属推荐
     * 接口地址：/top/card
     * @param params { card_id }
     * @returns 推荐歌曲列表
     * @example /top/card?card_id=1
     */
    topCard(params: {
        card_id: number | string;
    }): Promise<KGTopCardResponse>;
    /**
     * 新歌速递
     * 说明：获取新歌速递
     * 接口地址：/top/song
     * @returns 新歌速递列表
     * @example /top/song
     */
    topSong(): Promise<KGTopSongResponse>;
    /**
     * 场景音乐列表
     * 说明：获取场景音乐列表
     * 接口地址：/scene/lists
     * @returns 场景音乐列表
     * @example /scene/lists
     */
    sceneLists(): Promise<KGSceneListResponse>;
    /**
     * 场景音乐详情
     * 说明：获取场景音乐详情
     * 必选参数：
     * - id：场景音乐 scene_id
     * 接口地址：/scene/module
     * @param id 场景音乐 scene_id
     * @returns 场景音乐详情
     * @example /scene/module?id=9
     */
    sceneModule(id: number | string): Promise<KGSceneModuleResponse>;
    /**
     * 获取场景音乐模块 Tag
     * 说明：获取场景模块 Tag
     * 必选参数：
     * - id：场景音乐 scene_id
     * - module_id：场景音乐 module_id
     * 接口地址：/scene/module/info
     * @param params { id, module_id }
     * @returns 场景音乐模块 Tag
     * @example /scene/module/info?id=9&module_id=83
     */
    sceneModuleInfo(params: {
        id: number | string;
        module_id: number | string;
    }): Promise<KGSceneModuleInfoResponse>;
    /**
     * 获取场景音乐歌单列表
     * 说明：获取场景音乐歌单列表
     * 必选参数：
     * - tag_id：场景音乐 tag_id
     * 可选参数：
     * - page：页码
     * - pagesize：每页页数，默认为 30
     * 接口地址：/scene/collection/list
     * @param params { tag_id, page?, pagesize? }
     * @returns 场景音乐歌单列表
     * @example /scene/collection/list?tag_id=42391
     */
    sceneCollectionList(params: {
        tag_id: number | string;
        page?: number;
        pagesize?: number;
    }): Promise<KGScenePlaylistResponse>;
    /**
     * 每日推荐
     * 说明：获取每日推荐列表
     * 可选参数：
     * - platform：设备类型，默认为 ios，支持 android 和 ios
     * 接口地址：/everyday/recommend
     * @param platform 设备类型，可选：android 或 ios
     * @returns 每日推荐列表
     * @example /everyday/recommend
     */
    everydayRecommend(platform?: string): Promise<KGEveryDayRecommendResponse>;
    /**
     * 搜索歌词（前置接口）
     * 说明：根据歌曲哈希查询歌词资源，获取后续调用 /lyric 所需的 id 与 accesskey。
     * 接口地址：/search/lyric
     * @param hash 歌曲哈希
     * @returns 搜索歌词响应（包含 id、accesskey 等）
     * @example /search/lyric?hash=xxxx
     */
    searchLyric(hash: string, man?: boolean): Promise<KGSearchhLyricResponse>;
    /**
     * 获取歌词
     * 说明：调用此接口，可以获取歌词；调用该接口前需先调用 /search/lyric 获取完整参数。
     * 必选参数：
     * - id：歌词 id，可从 /search/lyric 接口获取
     * - accesskey：歌词 accesskey，可从 /search/lyric 接口获取
     * 可选参数：
     * - fmt：歌词类型，lrc 为普通歌词，krc 为逐字歌词
     * - decode：是否解码，传入该参数则返回解码后的歌词
     * 接口地址：/lyric
     * @param params { id, accesskey, fmt?, decode? }
     * @returns 歌词响应结果
     * @example /lyric?id=xxx&accesskey=xxx
     * @example /lyric?id=xxx&accesskey=xxx&fmt=lrc
     * @example /lyric?id=xxx&accesskey=xxx&decode=true
     */
    lyric(params: KGLyricParams): Promise<KGLyricResponse>;
}
export {};
