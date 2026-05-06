import MusicApi from "./MusicApi";
import { QQSearchResponse } from "../types/QQ/QQSearch";
import { QQSearchHotResponse } from "../types/QQ/QQSearchHot";
import { QQUserDetailResponse } from "../types/QQ/QQUserDetail";
import { QQViewCookieResponse } from "../types/QQ/QQViewCookie";
export declare class QQAPI extends MusicApi {
    /**
     * 搜索接口
     * 说明：调用此接口，传入关键词可进行搜索，支持单曲、歌单、歌词、专辑、歌手、MV 等多类型。
     * 接口地址：/search
     * 必选参数：
     * - key：关键词
     * 可选参数：
     * - pageNo：页码，默认 1
     * - pageSize：每页返回数量，默认 20
     * - t：搜索类型，默认 0（0：单曲，2：歌单，7：歌词，8：专辑，9：歌手，12：mv）
     * @param params { key, pageNo?, pageSize?, t? }
     * @returns 搜索结果
     * @example /search?key=周杰伦
     */
    search(params: {
        key: string;
        pageNo?: number;
        pageSize?: number;
        t?: number;
    }): Promise<QQSearchResponse>;
    /**
     * 获取热搜词
     * 说明：调用此接口，可获取热门搜索列表
     * 接口地址：/search/hot
     * @returns 热搜词列表
     * @example /search/hot
     */
    searchHot(): Promise<QQSearchHotResponse>;
    /**
     * 设置用户 Cookie
     * 说明：将用户 Cookie 存储到服务器。仅支持 POST，Content-Type: application/json。
     * 接口地址：/user/setCookie
     * 必选参数：
     * - data：字符串，cookie 信息，格式如：aaa=bbb; ccc=ddd; ...
     * @param payload { data }
     * @returns 设置结果
     */
    setCookie(payload: {
        data: string;
    }): Promise<any>;
    /**
     * 获取用户 Cookie
     * 说明：从服务器上获取通过 /user/setCookie 存储的 Cookie（会直接注入浏览器）。
     * 接口地址：/user/getCookie
     * 必选参数：
     * - id：QQ 号或微信 wxuin
     * @param params { id }
     * @returns 用户 Cookie 信息
     */
    getUserCookie(params: {
        id: string | number;
    }): Promise<{
        result: number;
        data: string;
    }>;
    /**
     * 查看当前 Cookie
     * 说明：返回当前网站下的 Cookie 对象。
     * 接口地址：/user/cookie
     * @returns 当前 Cookie（Object）
     */
    viewCookie(): Promise<QQViewCookieResponse>;
    /**
     * 刷新登录
     * 说明：用于延长登录有效期（仅限 QQ 登录），刷新 cookie 中的 qm_keyst 与 qqmusic_key。
     * 接口地址：/user/refresh
     * @returns 刷新结果
     */
    refresh(): Promise<any>;
    /**
     * 用户主页信息
     * 说明：需要登录 Cookie，未登录将返回 301；返回中 mymusic 为喜欢的音乐，mydiss 为用户创建的歌单。
     * 注意：喜欢的音乐中的歌单 id 为 id，歌单中的歌单 id 为 dissid。
     * 接口地址：/user/detail
     * 必选参数：
     * - id：QQ 号
     * @param params { id }
     * @returns 用户主页信息
     * @example /user/detail?id=123456
     */
    userDetail(params: {
        id: string | number;
    }): Promise<QQUserDetailResponse>;
    /**
     *
     * @param params
     * {
     * "data": {
     * "0039MnYb0qxYhV": "http://ws.stream.qqmusic.qq.com/C400002202B43Cq4V4.m4a?guid=2796982635&vkey=0A1ADCEDC042ABE27FE184A3436DBB6F15AFF286F0F06DDFAEA9ADAF2D82F67EF33746A9472F62B444B7E7CEB32EE0D34DFD53A6E2D97D7B&uin=1899&fromtag=66",
     * },
     * "result": 100
     * }
     */
    getUrls(params: {
        songmid: string[];
    }): Promise<{
        data: {
            [key: string]: string;
        };
        result: number;
    }>;
    /**
     * id: songmid
     * type: 默认 128 // 128：mp3 128k，320：mp3 320k，m4a：m4a格式 128k，flac：flac格式 无损，ape：ape格式 无损
     * mediaId: 这个字段为其他接口中返回的 strMediaId 字段，可不传，不传默认同 songmid
     * isRedirect: 默认 0，非 0 时直接重定向到播放链接
     * @param params
     * @returns
     */
    getDowloadUrl(params: {
        id: string;
        type?: '128' | '320' | 'm4a' | 'flac' | 'ape';
        mediaId?: string;
        isRedirect?: number;
    }): Promise<any>;
}
