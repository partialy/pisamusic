import u from "axios";
class h {
  authKey = "your_api_key";
  baseURL = "https://api.musicapi.com";
  originUrl = "";
  backupUrl = [];
  currentUrlIndex = 0;
  extensionUrl = "";
  customHeaders = {};
  request;
  retryCount = 0;
  constructor(t) {
    const { baseURL: e, extensionUrl: a, backupUrl: s, retryCount: r, authKey: n } = t;
    this.baseURL = e.endsWith("/") ? e.slice(0, -1) : e, this.extensionUrl = a ? a.startsWith("/") ? a : "/" + a : "", this.authKey = n?.trim() || "your_api_key", this.backupUrl = s || [], this.retryCount = r || 0, this.originUrl = e, this.request = u.create({
      baseURL: this.baseURL,
      timeout: 1e4
    });
  }
  getRequest() {
    return this.request;
  }
  getStruct() {
    return {
      authKey: this.authKey,
      backupUrl: this.backupUrl,
      retryCount: this.retryCount,
      extensionUrl: this.extensionUrl
    };
  }
  setAuthKey(t) {
    this.authKey = t.trim();
  }
  setBaseURL(t) {
    this.baseURL = t.endsWith("/") ? t.slice(0, -1) : t;
  }
  setExtensionUrl(t) {
    this.extensionUrl = t ? t.startsWith("/") ? t : "/" + t : "";
  }
  setHeaders(t) {
    this.customHeaders = t;
  }
  getHeaders() {
    return this.customHeaders;
  }
  getAuthKey() {
    return this.authKey;
  }
  getBaseURL() {
    return this.baseURL;
  }
  getExstensionUrl() {
    return this.extensionUrl;
  }
  /**
   * 默认GET，参数为query
   * @param url 路径
   * @param params 参数，POST时候自动添加到body
   * @param config request配置
   * @returns T
   */
  async fetchData(t, e, a = {
    method: "GET"
  }) {
    const s = {
      "Content-Type": "application/json",
      Authorization: `${this.authKey}`,
      ...this.customHeaders,
      ...a?.headers
    };
    a.headers = s;
    let r = t;
    return !t.startsWith("/") && !t.startsWith("http") && (r = `/${t}`), new Promise(async (n, o) => {
      try {
        const c = await this.request({
          url: t.startsWith("http") ? t : `${this.extensionUrl}${r}`,
          ...a,
          params: e,
          data: e
        });
        n(c.data);
      } catch (c) {
        console.error(`Error fetching data from ${t}: ${c}`), o(c);
      }
    });
  }
  switchUrl(t = !1) {
    if (t || this.backupUrl.length == 0)
      this.baseURL = this.originUrl;
    else if (this.backupUrl.length > 0) {
      const e = (this.currentUrlIndex + 1) % this.backupUrl.length;
      this.baseURL = this.backupUrl[e];
    }
    return `切换到${this.baseURL}`;
  }
}
class y extends h {
  tokenCookie = {};
  tokenCookieString = [];
  setLocalCookie(t) {
    let e = {};
    const a = t.split(";;");
    for (const s of a) {
      this.tokenCookieString.push(s);
      const [r, n] = s.split("=");
      r && (e[r] = n);
    }
    this.tokenCookie = e;
  }
  /**
   * 刷新token并存储到tokenCookie
   * @param cb 登录成功回调,参数为登录成功返回的cookie
   */
  async refreshToken(t) {
    return new Promise(async (e, a) => {
      try {
        const s = await this.loginRefresh({
          token: this.tokenCookie?.token,
          userId: this.tokenCookie?.userid
        });
        s.data?.token && (this.tokenCookie = { KUGOU_API_PLATFORM: "", ...s.data }, t && t(s), e(s)), a(s);
      } catch (s) {
        a(s);
      }
    });
  }
  // 用户信息
  /**
   * 获取用户额外信息
   * 说明：登陆后调用此接口，可以获取用户额外信息
   * 接口地址： /user/detail
   * @returns 用户信息
   */
  async userDetail() {
    return this.fetchData("/user/detail");
  }
  /**
   * 获取用户 vip 信息
   * 说明：登陆后调用此接口，可以获取用户 vip 信息
   * 接口地址： /user/vip/detail
   * @returns 用户vip信息
   */
  async userVipDetail() {
    return this.fetchData("/user/vip/detail");
  }
  /**
   * 获取用户云盘音乐
   * @param param:{ page: number, pagesize: number }
   * @returns
   */
  async userCloud(t) {
    return this.fetchData("/user/cloud", t);
  }
  /**
   * 获取用户云盘音乐url
   * @param param : { hash: string }
   * @returns
   */
  async userCloudUrl(t) {
    return this.fetchData("/user/cloud/url", t);
  }
  // 登录相关
  /**
   * 获取验证码
   * @param param : { mobile: string }
   * @returns
   */
  async sendCode(t) {
    return this.fetchData("/captcha/sent", t);
  }
  /**
   * 登录
   * @param param : { mobile: string, code: string }
   * @returns
   */
  async loginCellphone(t) {
    return this.fetchData("/login/cellphone", t);
  }
  /**
   * 获取二维码登录密钥
   */
  async qrCodeKey() {
    return this.fetchData("/login/qr/key");
  }
  /**
   * 创建二维码
   * @param key QRCOde key
   */
  async qrCodeCreate(t) {
    return this.fetchData("/login/qr/create", {
      key: t,
      timestamp: Date.now()
    });
  }
  /**
   * 检查二维码登录状态
   * @param key QRCOde key
   */
  async qrCodeCheck(t) {
    return this.fetchData("/login/qr/check", {
      key: t,
      timestamp: Date.now()
    });
  }
  /**
   *
   * @param params 刷新参数
   * @returns KGLoginRefreshResponse
   */
  async loginRefresh(t) {
    return this.fetchData("/login/token", t);
  }
  // 搜索相关
  /**
   * 搜索音乐
   * @param searchParams 搜索参数
   * @returns 搜索响应结果
   */
  async search(t) {
    return this.fetchData("/search", t);
  }
  /**
   * 获取歌曲播放URL
   * @param urlParams URL参数
   * @returns 歌曲URL响应结果
   */
  async url(t) {
    return this.fetchData("/song/url", t);
  }
  /**
   * 热搜列表
   * 说明：调用此接口，可获取热门搜索列表
   * 接口地址：/search/hot
   * @returns 热搜列表
   * @example /search/hot
   */
  async searchHot() {
    return this.fetchData("/search/hot");
  }
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
  async searchSuggest(t, e) {
    return this.fetchData("/search/suggest", {
      keywords: t,
      ...e
    });
  }
  // 歌单相关
  /**
   * 歌单分类
   * 说明：获取歌单分类，包含 category 信息
   * 接口地址：/playlist/tags
   * @returns 歌单分类列表
   * @example /playlist/tags
   */
  async playlistTags() {
    return this.fetchData("/playlist/tags");
  }
  /**
   * 获取用户歌单列表
   * @returns 用户歌单响应结果
   */
  async userPlayList() {
    return this.fetchData("/user/playlist");
  }
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
  async topPlaylist(t) {
    return this.fetchData("/top/playlist", t);
  }
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
  async playListDetail(t) {
    const e = t.join(",");
    return this.fetchData("/playlist/detail", { ids: e });
  }
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
  async playListTracks(t) {
    return this.fetchData("/playlist/track/all", t);
  }
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
  async playListSimilar(t) {
    const e = t.join(",");
    return this.fetchData("/playlist/similar", {
      ids: e
    });
  }
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
  async topCard(t) {
    return this.fetchData("/top/card", t);
  }
  /**
   * 新歌速递
   * 说明：获取新歌速递
   * 接口地址：/top/song
   * @returns 新歌速递列表
   * @example /top/song
   */
  async topSong() {
    return this.fetchData("/top/song");
  }
  // 场景音乐相关
  /**
   * 场景音乐列表
   * 说明：获取场景音乐列表
   * 接口地址：/scene/lists
   * @returns 场景音乐列表
   * @example /scene/lists
   */
  async sceneLists() {
    return this.fetchData("/scene/lists");
  }
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
  async sceneModule(t) {
    return this.fetchData("/scene/module", { id: t });
  }
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
  async sceneModuleInfo(t) {
    return this.fetchData(
      "/scene/module/info",
      t
    );
  }
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
  async sceneCollectionList(t) {
    return this.fetchData(
      "/scene/collection/list",
      t
    );
  }
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
  async everydayRecommend(t) {
    return this.fetchData("/everyday/recommend", {
      platform: t
    });
  }
  // 歌词相关
  /**
   * 搜索歌词（前置接口）
   * 说明：根据歌曲哈希查询歌词资源，获取后续调用 /lyric 所需的 id 与 accesskey。
   * 接口地址：/search/lyric
   * @param hash 歌曲哈希
   * @returns 搜索歌词响应（包含 id、accesskey 等）
   * @example /search/lyric?hash=xxxx
   */
  async searchLyric(t, e) {
    return this.fetchData("/search/lyric", {
      hash: t,
      man: e
    });
  }
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
  async lyric(t) {
    return this.fetchData("/lyric", t);
  }
}
class f extends h {
  async search(t) {
    return this.fetchData("/search", t);
  }
  async url(t) {
    return this.fetchData("/url", t);
  }
}
class D extends h {
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
  async search(t) {
    return this.fetchData("/search", t);
  }
  /**
   * 获取热搜词
   * 说明：调用此接口，可获取热门搜索列表
   * 接口地址：/search/hot
   * @returns 热搜词列表
   * @example /search/hot
   */
  async searchHot() {
    return this.fetchData("/search/hot");
  }
  /**
   * 设置用户 Cookie
   * 说明：将用户 Cookie 存储到服务器。仅支持 POST，Content-Type: application/json。
   * 接口地址：/user/setCookie
   * 必选参数：
   * - data：字符串，cookie 信息，格式如：aaa=bbb; ccc=ddd; ...
   * @param payload { data }
   * @returns 设置结果
   */
  async setCookie(t) {
    return this.fetchData("/user/setCookie", t, { method: "POST" });
  }
  /**
   * 获取用户 Cookie
   * 说明：从服务器上获取通过 /user/setCookie 存储的 Cookie（会直接注入浏览器）。
   * 接口地址：/user/getCookie
   * 必选参数：
   * - id：QQ 号或微信 wxuin
   * @param params { id }
   * @returns 用户 Cookie 信息
   */
  async getUserCookie(t) {
    return this.fetchData("/user/getCookie", t);
  }
  /**
   * 查看当前 Cookie
   * 说明：返回当前网站下的 Cookie 对象。
   * 接口地址：/user/cookie
   * @returns 当前 Cookie（Object）
   */
  async viewCookie() {
    return this.fetchData("/user/cookie", {});
  }
  /**
   * 刷新登录
   * 说明：用于延长登录有效期（仅限 QQ 登录），刷新 cookie 中的 qm_keyst 与 qqmusic_key。
   * 接口地址：/user/refresh
   * @returns 刷新结果
   */
  async refresh() {
    return this.fetchData("/user/refresh", {});
  }
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
  async userDetail(t) {
    return this.fetchData("/user/detail", t);
  }
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
  async getUrls(t) {
    let e = "";
    return t.songmid.length > 0 && (e = t.songmid.join(",")), this.fetchData("/song/urls", { id: e });
  }
  /**
   * id: songmid
   * type: 默认 128 // 128：mp3 128k，320：mp3 320k，m4a：m4a格式 128k，flac：flac格式 无损，ape：ape格式 无损
   * mediaId: 这个字段为其他接口中返回的 strMediaId 字段，可不传，不传默认同 songmid
   * isRedirect: 默认 0，非 0 时直接重定向到播放链接
   * @param params 
   * @returns 
   */
  async getDowloadUrl(t) {
    return this.fetchData("/song/url", t);
  }
}
class d extends h {
  returnCookie = [];
  /**
   * 设置刷新后的Cookie
   * @param cookie
   */
  setReturnCookie(t) {
    this.returnCookie = t.split(";;");
  }
  /**
   * 获取返回的Cookie，不包含musicU
   * @returns Cookie
   */
  getReturnCookie() {
    return this.returnCookie.join(";;");
  }
  /**
   * 刷新Cookie
   * @returns Cookie
   */
  async refreshCookie(t) {
    return new Promise(async (e, a) => {
      try {
        const s = await this.loginRefresh();
        s.code == 200 && (this.setReturnCookie(s.cookie), t(s), e(s));
      } catch (s) {
        a(s);
      }
    });
  }
  // 登录相关
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
  async captchaSent(t) {
    return this.fetchData("/captcha/sent", t);
  }
  /**
   * 容易风险，不建议用
   * @param params { phone: string; captcha?: string;password?: string }
   * @returns 
   */
  async loginCellphone(t) {
    return this.fetchData("/login/cellphone", t);
  }
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
  async captchaVerify(t) {
    return this.fetchData("/captcha/verify", t);
  }
  /**
   * 二维码 key 生成接口
   * 说明：调用此接口可生成一个 key，用于后续二维码生成
   * 接口地址：/login/qr/key
   * @returns 二维码 key
   */
  async loginQrKey() {
    return this.fetchData("/login/qr/key", {
      timestamp: Date.now()
    });
  }
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
  async loginQrCreate(t) {
    return this.fetchData("/login/qr/create", {
      ...t,
      timestamp: Date.now()
    });
  }
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
  async loginQrCheck(t) {
    return this.fetchData("/login/qr/check", {
      ...t,
      timestamp: Date.now()
    });
  }
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
  async search(t) {
    return this.fetchData("/search", t);
  }
  /**
   * 刷新登录
   * 说明 : 调用此接口 , 可刷新登录状态,返回内容包含新的cookie(不支持刷新二维码登录的cookie)
   * 调用例子 : /login/refresh
   * @returns
   */
  async loginRefresh() {
    return this.fetchData("/login/refresh", {});
  }
  /**
   * 获取账号信息
   * 说明：登录后调用此接口，可获取用户账号信息
   * 接口地址：/user/account
   * @returns 用户账号信息
   * @example /user/account
   */
  async userAccount() {
    return this.fetchData("/user/account");
  }
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
  async userDetail(t) {
    return this.fetchData("/user/detail", t);
  }
  /**
   * 获取用户等级信息
   * 说明：登录后调用此接口，可以获取用户等级信息，包含当前登录天数、听歌次数、下一等级需要的登录天数和听歌次数、当前等级进度，对应 https://music.163.com/#/user/level
   * 接口地址：/user/level
   * @returns 用户等级信息
   * @example /user/level
   */
  async userLevel() {
    return this.fetchData("/user/level");
  }
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
  async userPlaylist(t) {
    return this.fetchData("/user/playlist", t);
  }
  // 歌单分类与标签
  /**
   * 歌单分类
   * 说明：获取歌单分类，包含 category 信息
   * 接口地址：/playlist/catlist
   * @returns 歌单分类
   * @example /playlist/catlist
   */
  async playlistCatlist() {
    return this.fetchData("/playlist/catlist");
  }
  /**
   * 热门歌单分类
   * 说明：获取热门歌单分类
   * 接口地址：/playlist/hot
   * @returns 热门歌单分类
   * @example /playlist/hot
   */
  async playlistHot() {
    return this.fetchData("/playlist/hot");
  }
  /**
   * 精品歌单标签列表
   * 说明：获取精品歌单标签列表
   * 接口地址：/playlist/highquality/tags
   * @returns 精品歌单标签列表
   * @example /playlist/highquality/tags
   */
  async playlistHighqualityTags() {
    return this.fetchData(
      "/playlist/highquality/tags"
    );
  }
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
  async topPlaylistHighquality(t) {
    return this.fetchData(
      "/top/playlist/highquality",
      t
    );
  }
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
  async relatedPlaylist(t) {
    return this.fetchData("/related/playlist", t);
  }
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
  async playlistDetail(t) {
    return this.fetchData("/playlist/detail", t);
  }
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
  async playlistTrackAll(t) {
    return this.fetchData(
      "/playlist/track/all",
      t
    );
  }
  // 音乐链接相关
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
  async songUrl(t) {
    return this.fetchData("/song/url", t);
  }
  /**
   * 获取客户端歌曲下载 url
   * 说明 : 使用 /song/url 接口获取的是歌曲试听 url, 但存在部分歌曲在非 VIP 账号上可以下载无损音质而不能试听无损音质, 使用此接口可使非 VIP 账号获取这些歌曲的无损音频
   * 必选参数 : id : 音乐 id (仅支持单首歌曲)
   * 可选参数 : br : 码率, 默认设置了 999000 即最大码率, 如果要 320k 则可设置为 320000, 其他类推
   * 接口地址 : /song/download/url
   */
  async songDownloadUrl(t) {
    return this.fetchData("/song/download/url", t);
  }
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
  async songUrlV1(t) {
    return this.fetchData("/song/url/v1", t);
  }
  // 搜索相关（更全）
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
  async cloudSearch(t) {
    return this.fetchData("/cloudsearch", t);
  }
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
  async searchAll(t) {
    return this.fetchData("/search", t);
  }
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
  async searchSuggest(t) {
    return this.fetchData("/search/suggest", t);
  }
  /**
   * 热搜列表（简略）
   * 说明：获取热门搜索列表
   * 接口地址：/search/hot
   * @returns 热搜列表
   * @example /search/hot
   */
  async searchHot() {
    return this.fetchData("/search/hot");
  }
  // 歌词与每日推荐
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
  async lyric(t) {
    return this.fetchData("/lyric", t);
  }
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
  async lyricNew(t) {
    return this.fetchData("/lyric/new", t);
  }
  /**
   * 获取每日推荐歌单（需要登录）
   * 说明：可获得每日推荐歌单
   * 接口地址：/recommend/resource
   * @returns 每日推荐歌单
   * @example /recommend/resource
   */
  async recommendResource() {
    return this.fetchData("/recommend/resource");
  }
  /**
   * 获取每日推荐歌曲（需要登录）
   * 说明：可获得每日推荐歌曲
   * 接口地址：/recommend/songs
   * @returns 每日推荐歌曲
   * @example /recommend/songs
   */
  async recommendSongs() {
    return this.fetchData("/recommend/songs");
  }
  // 云贝相关
  /**
   * 云贝
   * 说明：登录后调用此接口可获取云贝签到信息（连续签到天数、第二天可获得的云贝数）
   * 接口地址：/yunbei
   * @returns 云贝签到信息
   * @example /yunbei
   */
  async yunbei() {
    return this.fetchData("/yunbei");
  }
  /**
   * 云贝今日签到信息
   * 说明：登录后调用此接口可获取今日签到获取的云贝数
   * 接口地址：/yunbei/today
   * @returns 今日云贝签到信息
   * @example /yunbei/today
   */
  async yunbeiToday() {
    return this.fetchData("/yunbei/today");
  }
  /**
   * 云贝签到
   * 说明：登录后调用此接口可进行云贝签到
   * 接口地址：/yunbei/sign
   * @returns 云贝签到结果
   * @example /yunbei/sign
   */
  async yunbeiSign() {
    return this.fetchData("/yunbei/sign");
  }
  /**
   * 云贝账户信息
   * 说明：登录后调用此接口可获取云贝账户信息（账户云贝数）
   * 接口地址：/yunbei/info
   * @returns 云贝账户信息
   * @example /yunbei/info
   */
  async yunbeiInfo() {
    return this.fetchData("/yunbei/info");
  }
  /**
   * 获取歌曲详情
   * 说明 : 调用此接口 , 传入音乐 id(支持多个 id, 用 , 隔开), 可获得歌曲详情(dt为歌曲时长)
   * 必选参数 : ids: 音乐 id, 如 ids=347230
   * 接口地址 : /song/detail
   * 调用例子 : /song/detail?ids=347230,/song/detail?ids=347230,347231
   * 
   */
  async songDetail(t) {
    return this.fetchData("/song/detail", t);
  }
  /**
   * 歌曲音质详情
   * 说明: 调用此接口获取歌曲各个音质的文件信息，与 获取歌曲详情 接口相比，多出 高清环绕声、沉浸环绕声、超清母带等音质的信息必选参数：
   * id: 歌曲id
   * 接口地址: /song/music/detail
   * 调用例子: /song/music/detail?id=2082700997
   */
  async songMusicDetail(t) {
    return this.fetchData("/song/music/detail", t);
  }
  /**
   * 歌曲动态封面
   * 说明 : 登录后调用此接口, 传入歌曲id, 获取歌曲动态封面
   * 必选参数 :
   * id: 歌曲 id
   * 接口地址 : /song/dynamic/cover
   * 调用例子 : /song/dynamic/cover?id=2101179024
   */
  async songDynamicCover(t) {
    return this.fetchData("/song/dynamic/cover", t);
  }
}
export {
  y as KGAPI,
  f as KWAPI,
  D as QQAPI,
  d as WYAPI
};
