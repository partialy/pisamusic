import MusicApi from "./MusicApi";
import { WYCloudSearchResponse } from "../types/WY/WYCloudSearch";
import { WYHighQualityListsResponse } from "../types/WY/WYHighQualityLists";
import { WYLyricResponse } from "../types/WY/WYLyric";
import { WYPlaylistCatListResponse } from "../types/WY/WYPlaylistCatList";
import { WYPlaylistDetailResponse } from "../types/WY/WYPlaylistDetail";
import { WYPlaylistHighqualityTagsResponse } from "../types/WY/WYPlaylistHighqualityTags";
import { WYPlaylistHotResponse } from "../types/WY/WYPlaylistHot";
import { WYPlaylistTrackResponse } from "../types/WY/WYPlaylistTrack";
import { WYRecommendResourceResponse } from "../types/WY/WYRecommendResource";
import { WYRecommendSongsResponse } from "../types/WY/WYRecommendSongs";
import { WYSearchResponse } from "../types/WY/WYSearch";
import { WYSearchHotResponse } from "../types/WY/WYSearchHot";
import { WYSearchSuggestResponse } from "../types/WY/WYSearchSuggest";
import { WYUrlResponse } from "../types/WY/WYUrl";
import { WYUserAccountResponse } from "../types/WY/WYUserAccount";
import { WYUserDetailResponse } from "../types/WY/WYUserDetail";
import { WYUserLevelResponse } from "../types/WY/WYUserLevel";
import { WYUserPlaylistResponse } from "../types/WY/WYUserPlaylist";
import { WYYunbeiInfoResponse, WYYunbeiResponse, WYYunbeiSignResponse, WYYunbeiTodayResponse } from "../types/WY/WYYunbei";
import { WYQRCodeCheckResponse, WYQRCodeCreateResponse, WYQRCodeResponse } from "../types/WY/WYQRCode";
import { WYSongDetail } from "../types/WY/WYSongDetail";
import { WYQualityRes } from "../types/WY/WYQuality";
import { WYDynamicCoverRes } from "../types/WY/WYDynamicCover";
import { WYCloudSearchListResponse } from "../types/WY/WYCloudSearchList";
export declare class WYAPI extends MusicApi {
    protected returnCookie: string[];
    /**
     * 设置刷新后的Cookie
     * @param cookie
     */
    setReturnCookie(cookie: string): void;
    /**
     * 获取返回的Cookie，不包含musicU
     * @returns Cookie
     */
    getReturnCookie(): string;
    /**
     * 刷新Cookie
     * @returns Cookie
     */
    refreshCookie(cb: (res: {
        bizCode: string;
        code: number;
        cookie: string;
    }) => void): Promise<unknown>;
    /**
     * 发送验证码
     * 说明：调用此接口，传入手机号码，可发送验证码
     * 必选参数：
     * - phone：手机号码
     * 可选参数：
     * - ctcode：国家区号，默认 86 即中国
     * 接口地址：/captcha/sent
     * @param params { phone, ctcode? }
     * @returns 发送验证码结果
     * @example /captcha/sent?phone=13xxx
     */
    captchaSent(params: {
        phone: string;
        ctcode?: number;
    }): Promise<{
        code: 200;
        data: boolean;
    }>;
    /**
     * 容易风险，不建议用
     * @param params { phone: string; captcha?: string;password?: string }
     * @returns
     */
    loginCellphone(params: {
        phone: string;
        captcha?: string;
        password?: string;
    }): Promise<{
        loginType: 1;
        hitType: 8;
        code: 8810;
        message: string;
        redirectUrl: string;
    }>;
    /**
     * 验证验证码
     * 说明：调用此接口，传入手机号码和验证码，可校验验证码是否正确
     * 必选参数：
     * - phone：手机号码
     * - captcha：验证码
     * 可选参数：
     * - ctcode：国家区号，默认 86 即中国
     * 接口地址：/captcha/verify
     * @param params { phone, captcha, ctcode? }
     * @returns 验证验证码结果
     * @example /captcha/verify?phone=13xxx&captcha=1597
     */
    captchaVerify(params: {
        phone: string;
        captcha: string;
        ctcode?: number;
    }): Promise<{
        code: 200;
        data: true;
    }>;
    /**
     * 二维码 key 生成接口
     * 说明：调用此接口可生成一个 key，用于后续二维码生成
     * 接口地址：/login/qr/key
     * @returns 二维码 key
     */
    loginQrKey(): Promise<WYQRCodeResponse>;
    /**
     * 二维码生成接口
     * 说明：传入上一个接口生成的 key 可生成二维码图片的 base64 和二维码信息
     * 必选参数：
     * - key：由第一个接口生成
     * 可选参数：
     * - qrimg：传入后会额外返回二维码图片 base64 编码
     * 接口地址：/login/qr/create
     * @param params { key, qrimg? }
     * @returns 二维码信息（包含 base64 图片）
     * @example /login/qr/create?key=xxx
     */
    loginQrCreate(params: {
        key: string;
        qrimg?: boolean;
    }): Promise<WYQRCodeCreateResponse>;
    /**
     * 二维码检测扫码状态接口
     * 说明：轮询此接口可获取二维码扫码状态
     * 状态码说明：800 为二维码过期，801 为等待扫码，802 为待确认，803 为授权登录成功（返回 cookies）
     * 注意：如扫码后返回 502，则需加上 noCookie 参数
     * 必选参数：
     * - key：由第一个接口生成
     * 可选参数：
     * - noCookie：如返回 502 则传 true
     * 接口地址：/login/qr/check
     * @param params { key, noCookie? }
     * @returns 二维码扫码状态
     * @example /login/qr/check?key=xxx
     * @example /login/qr/check?key=xxx&noCookie=true
     */
    loginQrCheck(params: {
        key: string;
        noCookie?: boolean;
    }): Promise<WYQRCodeCheckResponse>;
    /**
     * 搜索接口
     * 说明：调用此接口，传入关键词可进行搜索
     * 接口地址：/search
     * 必选参数：
     * - keywords：搜索关键词
     * 可选参数：
     * - page：页码
     * - pagesize：每页返回数量
     * @param params { keywords, page?, pagesize? }
     * @returns 搜索结果
     */
    search(params: {
        keywords: string;
        page?: number;
        pagesize?: number;
    }): Promise<WYSearchResponse>;
    /**
     * 刷新登录
     * 说明 : 调用此接口 , 可刷新登录状态,返回内容包含新的cookie(不支持刷新二维码登录的cookie)
     * 调用例子 : /login/refresh
     * @returns
     */
    loginRefresh(): Promise<{
        bizCode: string;
        code: number;
        cookie: string;
    }>;
    /**
     * 获取账号信息
     * 说明：登录后调用此接口，可获取用户账号信息
     * 接口地址：/user/account
     * @returns 用户账号信息
     * @example /user/account
     */
    userAccount(): Promise<WYUserAccountResponse>;
    /**
     * 获取用户详情
     * 说明：登录后调用此接口，传入用户 id，可以获取用户详情
     * 接口地址：/user/detail
     * 必选参数：
     * - uid：用户 id
     * @param params { uid }
     * @returns 用户详情
     * @example /user/detail?uid=32953014
     */
    userDetail(params: {
        uid: string | number;
    }): Promise<WYUserDetailResponse>;
    /**
     * 获取用户等级信息
     * 说明：登录后调用此接口，可以获取用户等级信息，包含当前登录天数、听歌次数、下一等级需要的登录天数和听歌次数、当前等级进度，对应 https://music.163.com/#/user/level
     * 接口地址：/user/level
     * @returns 用户等级信息
     * @example /user/level
     */
    userLevel(): Promise<WYUserLevelResponse>;
    /**
     * 获取用户歌单
     * 说明：登录后调用此接口，传入用户 id，可以获取用户歌单
     * 接口地址：/user/playlist
     * 必选参数：
     * - uid：用户 id
     * 可选参数：
     * - limit：返回数量，默认为 30
     * - offset：偏移数量，用于分页，如：(页数-1)*30，其中 30 为 limit 的值，默认为 0
     * @param params { uid, limit?, offset? }
     * @returns 用户歌单列表
     * @example /user/playlist?uid=32953014
     */
    userPlaylist(params: {
        uid: string | number;
        limit?: number;
        offset?: number;
    }): Promise<WYUserPlaylistResponse>;
    /**
     * 歌单分类
     * 说明：获取歌单分类，包含 category 信息
     * 接口地址：/playlist/catlist
     * @returns 歌单分类
     * @example /playlist/catlist
     */
    playlistCatlist(): Promise<WYPlaylistCatListResponse>;
    /**
     * 热门歌单分类
     * 说明：获取热门歌单分类
     * 接口地址：/playlist/hot
     * @returns 热门歌单分类
     * @example /playlist/hot
     */
    playlistHot(): Promise<WYPlaylistHotResponse>;
    /**
     * 精品歌单标签列表
     * 说明：获取精品歌单标签列表
     * 接口地址：/playlist/highquality/tags
     * @returns 精品歌单标签列表
     * @example /playlist/highquality/tags
     */
    playlistHighqualityTags(): Promise<WYPlaylistHighqualityTagsResponse>;
    /**
     * 获取精品歌单
     * 说明：可获取精品歌单
     * 可选参数：
     * - cat：歌单分类，如 "华语"、"古风"、"欧美"、"流行"，默认 "全部"；可从 /playlist/highquality/tags 获取
     * - limit：取出歌单数量，默认 50
     * - before：分页参数，取上一页最后一个歌单的 updateTime 获取下一页数据
     * 接口地址：/top/playlist/highquality
     * @param params { cat?, limit?, before? }
     * @returns 精品歌单列表
     * @example /top/playlist/highquality?before=1503639064232&limit=3
     */
    topPlaylistHighquality(params?: {
        cat?: string;
        limit?: number;
        before?: number;
    }): Promise<WYHighQualityListsResponse>;
    /**
     * 相关歌单推荐
     * 说明：传入歌单 id 可获取相关歌单
     * 必选参数：
     * - id：歌单 id
     * 接口地址：/related/playlist
     * @param params { id }
     * @returns 相关歌单列表
     * @example /related/playlist?id=1
     */
    relatedPlaylist(params: {
        id: string | number;
    }): Promise<any>;
    /**
     * 获取歌单详情
     * 说明：传入歌单 id，获取歌单详细内容；未登录 tracks 不完整，可用返回的 trackIds 调用 song/detail 获取完整歌曲详情。
     * 必选参数：
     * - id：歌单 id
     * 可选参数：
     * - s：歌单最近的 s 个收藏者，默认 8
     * 接口地址：/playlist/detail
     * @param params { id, s? }
     * @returns 歌单详情
     * @example /playlist/detail?id=24381616
     */
    playlistDetail(params: {
        id: string | number;
        s?: number;
    }): Promise<WYPlaylistDetailResponse>;
    /**
     * 获取歌单所有歌曲
     * 说明：由于网易云接口限制，歌单详情只会提供部分歌曲，通过此接口可获取歌单全部歌曲
     * 必选参数：
     * - id：歌单 id
     * 可选参数：
     * - limit：限制获取歌曲的数量，默认为当前歌单歌曲数量
     * - offset：偏移量，默认 0
     * 接口地址：/playlist/track/all
     * @param params { id, limit?, offset? }
     * @returns 歌单全部歌曲
     * @example /playlist/track/all?id=24381616&limit=10&offset=1
     */
    playlistTrackAll(params: {
        id: string | number;
        limit?: number;
        offset?: number;
    }): Promise<WYPlaylistTrackResponse>;
    /**
     * 获取音乐 URL
     * 说明：传入音乐 id（可多个，逗号分隔）获取对应音乐 URL。未登录或非会员返回试听片段。
     * 注意：遇到 403 错误时，请在 head 标签内加入 <meta name="referrer" content="no-referrer">。
     * 必选参数：
     * - id：音乐 id，支持多个，逗号分隔
     * 可选参数：
     * - br：码率，默认 999000（最大）；320k 为 320000
     * 接口地址：/song/url
     * @param params { id, br? }
     * @returns 音乐 URL 列表
     * @example /song/url?id=33894312
     * @example /song/url?id=405998841,33894312
     */
    songUrl(params: {
        id: string;
        br?: number;
    }): Promise<WYUrlResponse>;
    /**
     * 获取客户端歌曲下载 url
     * 说明 : 使用 /song/url 接口获取的是歌曲试听 url, 但存在部分歌曲在非 VIP 账号上可以下载无损音质而不能试听无损音质, 使用此接口可使非 VIP 账号获取这些歌曲的无损音频
     * 必选参数 : id : 音乐 id (仅支持单首歌曲)
     * 可选参数 : br : 码率, 默认设置了 999000 即最大码率, 如果要 320k 则可设置为 320000, 其他类推
     * 接口地址 : /song/download/url
     */
    songDownloadUrl(params: {
        id: string;
        br?: number;
    }): Promise<WYUrlResponse>;
    /**
     * 获取音乐 URL（新版）
     * 说明：与 /song/url 使用注意事项相同
     * 必选参数：
     * - id：音乐 id（支持多个，逗号分隔）
     * - level：播放音质等级（standard/higher/exhigh/lossless/hires/jyeffect/sky/jymaster）
     * 接口地址：/song/url/v1
     * @param params { id, level }
     * @returns 音乐 URL 列表（新版）
     * @example /song/url/v1?id=33894312&level=exhigh
     * @example /song/url/v1?id=405998841,33894312&level=lossless
     */
    songUrlV1(params: {
        id: string;
        level: string;
    }): Promise<WYUrlResponse>;
    /**
     * 全量搜索（/cloudsearch）
     * 说明：传入关键词可以搜索音乐/专辑/歌手/歌单/用户等；type 控制类型
     * 必选参数：
     * - keywords：关键词
     * 可选参数：
     * - limit：返回数量，默认 30
     * - offset：偏移量，默认 0
     * - type：搜索类型（1单曲，10专辑，100歌手，1000歌单，1002用户，1004 MV，1006歌词，1009电台，1014视频，1018综合，2000声音）
     * 接口地址：/cloudsearch
     * @param params { keywords, limit?, offset?, type? }
     * @returns 搜索结果（更全）
     * @example /cloudsearch?keywords=海阔天空
     */
    cloudSearch(params: {
        keywords: string;
        limit?: number;
        offset?: number;
        type?: number;
    }): Promise<WYCloudSearchResponse | WYCloudSearchListResponse>;
    /**
     * 标准搜索（/search）
     * 说明：与 cloudsearch 类似，但字段相对简略
     * 必选参数：
     * - keywords：关键词
     * 可选参数：
     * - limit：返回数量，默认 30
     * - offset：偏移量，默认 0
     * - type：搜索类型（同 cloudsearch）
     * 接口地址：/search
     * @param params { keywords, limit?, offset?, type? }
     * @returns 搜索结果
     * @example /search?keywords=海阔天空
     */
    searchAll(params: {
        keywords: string;
        limit?: number;
        offset?: number;
        type?: number;
    }): Promise<WYSearchResponse>;
    /**
     * 搜索建议
     * 说明：传入搜索关键词可获得搜索建议；可选返回移动端数据
     * 必选参数：
     * - keywords：关键词
     * 可选参数：
     * - type：若传 'mobile' 则返回移动端数据
     * 接口地址：/search/suggest
     * @param params { keywords, type? }
     * @returns 搜索建议结果
     * @example /search/suggest?keywords=海阔天空
     * @example /search/suggest?keywords=海阔天空&type=mobile
     */
    searchSuggest(params: {
        keywords: string;
        type?: string;
    }): Promise<WYSearchSuggestResponse>;
    /**
     * 热搜列表（简略）
     * 说明：获取热门搜索列表
     * 接口地址：/search/hot
     * @returns 热搜列表
     * @example /search/hot
     */
    searchHot(): Promise<WYSearchHotResponse>;
    /**
     * 获取歌词
     * 说明：传入音乐 id 可获得对应音乐的歌词（无需登录）
     * 必选参数：
     * - id：音乐 id
     * 接口地址：/lyric
     * @param params { id }
     * @returns 歌词数据
     * @example /lyric?id=33894312
     */
    lyric(params: {
        id: string | number;
    }): Promise<WYLyricResponse>;
    /**
     * 获取逐字歌词
     * 说明：返回的 yrc 字段为逐字歌词（部分歌曲可能不包含逐字歌词）
     * 必选参数：
     * - id：音乐 id
     * 接口地址：/lyric/new
     * @param params { id }
     * @returns 逐字歌词数据
     * @example /lyric/new?id=1824020871
     */
    lyricNew(params: {
        id: string | number;
    }): Promise<WYLyricResponse>;
    /**
     * 获取每日推荐歌单（需要登录）
     * 说明：可获得每日推荐歌单
     * 接口地址：/recommend/resource
     * @returns 每日推荐歌单
     * @example /recommend/resource
     */
    recommendResource(): Promise<WYRecommendResourceResponse>;
    /**
     * 获取每日推荐歌曲（需要登录）
     * 说明：可获得每日推荐歌曲
     * 接口地址：/recommend/songs
     * @returns 每日推荐歌曲
     * @example /recommend/songs
     */
    recommendSongs(): Promise<WYRecommendSongsResponse>;
    /**
     * 云贝
     * 说明：登录后调用此接口可获取云贝签到信息（连续签到天数、第二天可获得的云贝数）
     * 接口地址：/yunbei
     * @returns 云贝签到信息
     * @example /yunbei
     */
    yunbei(): Promise<WYYunbeiResponse>;
    /**
     * 云贝今日签到信息
     * 说明：登录后调用此接口可获取今日签到获取的云贝数
     * 接口地址：/yunbei/today
     * @returns 今日云贝签到信息
     * @example /yunbei/today
     */
    yunbeiToday(): Promise<WYYunbeiTodayResponse>;
    /**
     * 云贝签到
     * 说明：登录后调用此接口可进行云贝签到
     * 接口地址：/yunbei/sign
     * @returns 云贝签到结果
     * @example /yunbei/sign
     */
    yunbeiSign(): Promise<WYYunbeiSignResponse>;
    /**
     * 云贝账户信息
     * 说明：登录后调用此接口可获取云贝账户信息（账户云贝数）
     * 接口地址：/yunbei/info
     * @returns 云贝账户信息
     * @example /yunbei/info
     */
    yunbeiInfo(): Promise<WYYunbeiInfoResponse>;
    /**
     * 获取歌曲详情
     * 说明 : 调用此接口 , 传入音乐 id(支持多个 id, 用 , 隔开), 可获得歌曲详情(dt为歌曲时长)
     * 必选参数 : ids: 音乐 id, 如 ids=347230
     * 接口地址 : /song/detail
     * 调用例子 : /song/detail?ids=347230,/song/detail?ids=347230,347231
     *
     */
    songDetail(params: {
        ids: string;
    }): Promise<WYSongDetail>;
    /**
     * 歌曲音质详情
     * 说明: 调用此接口获取歌曲各个音质的文件信息，与 获取歌曲详情 接口相比，多出 高清环绕声、沉浸环绕声、超清母带等音质的信息必选参数：
     * id: 歌曲id
     * 接口地址: /song/music/detail
     * 调用例子: /song/music/detail?id=2082700997
     */
    songMusicDetail(params: {
        id: string | number;
    }): Promise<WYQualityRes>;
    /**
     * 歌曲动态封面
     * 说明 : 登录后调用此接口, 传入歌曲id, 获取歌曲动态封面
     * 必选参数 :
     * id: 歌曲 id
     * 接口地址 : /song/dynamic/cover
     * 调用例子 : /song/dynamic/cover?id=2101179024
     */
    songDynamicCover(params: {
        id: string | number;
    }): Promise<WYDynamicCoverRes>;
}
