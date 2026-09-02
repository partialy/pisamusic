import type { ConfigDefinition, ConfigJsonValue } from "./configTypes";

function parseNumberInRange(val: unknown, min?: number, max?: number, def = 0): number {
  const num = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(num)) return def;
  const integer = Math.trunc(num);
  if (min !== undefined && integer < min) return def;
  if (max !== undefined && integer > max) return def;
  return integer;
}

function parseBoolean(val: unknown, def = false): boolean {
  if (typeof val === "boolean") return val;
  if (val === "true" || val === 1 || val === "1") return true;
  if (val === "false" || val === 0 || val === "0") return false;
  return def;
}

function parseStringList(val: unknown, def: string[] = []): string[] {
  if (Array.isArray(val)) {
    return val
      .map((item) => String(item ?? "").trim())
      .filter((s) => s.length > 0);
  }
  if (typeof val === "string") {
    return val
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return def;
}

export const CONFIG_DEFINITIONS: readonly ConfigDefinition[] = [
  // 下载安全与限流
  {
    key: "security.releaseDownloadTtlSeconds",
    group: "download_security",
    groupLabel: "下载安全",
    label: "安装包/更新下载链接有效期",
    description: "通过官网/更新接口生成的七牛私有下载签名 URL 有效时长（秒）",
    type: "number",
    defaultValue: 300,
    unit: "秒",
    min: 60,
    max: 3600,
    parse: (v) => parseNumberInRange(v, 60, 3600, 300),
    validate: (v) => (typeof v === "number" && v >= 60 && v <= 3600 ? null : "必须在 60 到 3600 秒之间"),
  },
  {
    key: "security.downloadRateLimitWindowSeconds",
    group: "download_rate_limit",
    groupLabel: "下载限流",
    label: "下载限流窗口长度",
    description: "单个 IP 下载限流统计滑动时间窗口（秒）",
    type: "number",
    defaultValue: 60,
    unit: "秒",
    min: 10,
    max: 3600,
    parse: (v) => parseNumberInRange(v, 10, 3600, 60),
    validate: (v) => (typeof v === "number" && v >= 10 && v <= 3600 ? null : "必须在 10 到 3600 秒之间"),
  },
  {
    key: "security.downloadRateLimitMaxRequests",
    group: "download_rate_limit",
    groupLabel: "下载限流",
    label: "窗口内最大下载请求数",
    description: "单个 IP 在限流窗口内允许访问下载相关接口的最大次数",
    type: "number",
    defaultValue: 5,
    unit: "次",
    min: 1,
    max: 100,
    parse: (v) => parseNumberInRange(v, 1, 100, 5),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 100 ? null : "必须在 1 到 100 次之间"),
  },
  {
    key: "security.downloadRateLimitPaths",
    group: "download_rate_limit",
    groupLabel: "下载限流",
    label: "限流下载入口路径列表",
    description: "共享下载限流计数桶的接口路径模式（支持末尾 * 通配）",
    type: "string[]",
    defaultValue: [
      "/api/config/download/*",
      "/api/config/release-files/*",
      "/api/config/desktop-updates/win32/x64/latest.yml",
      "/api/config/desktop-updates/win32/x64/*",
    ],
    parse: (v) => parseStringList(v, [
      "/api/config/download/*",
      "/api/config/release-files/*",
      "/api/config/desktop-updates/win32/x64/latest.yml",
      "/api/config/desktop-updates/win32/x64/*",
    ]),
    validate: (v) => {
      if (!Array.isArray(v) || v.length === 0) return "限流路径列表不能为空";
      for (const p of v) {
        if (typeof p !== "string" || !p.startsWith("/") || p.length > 200) {
          return "路径格式不合法（必须以 / 开头且不超过 200 字符）";
        }
      }
      return null;
    },
  },

  // 爬虫拦截
  {
    key: "security.websiteDownloadBotUserAgentSubstrings",
    group: "bot_blocking",
    groupLabel: "爬虫拦截",
    label: "官网下载明显爬虫 UA 关键字",
    description: "访问官网下载接口 /api/config/download/* 时拦截的 User-Agent 子串（不区分大小写）",
    type: "string[]",
    defaultValue: [
      "python/",
      "aiohttp/",
      "python-requests",
      "scrapy",
      "curl/",
      "wget/",
      "httpx",
      "go-http-client",
      "libwww-perl",
    ],
    parse: (v) => parseStringList(v, [
      "python/",
      "aiohttp/",
      "python-requests",
      "scrapy",
      "curl/",
      "wget/",
      "httpx",
      "go-http-client",
      "libwww-perl",
    ]),
    validate: (v) => {
      if (!Array.isArray(v)) return "UA 列表必须为数组";
      for (const item of v) {
        if (typeof item !== "string" || item.length > 100) return "单项关键字不能超过 100 字符";
      }
      return null;
    },
  },
  {
    key: "security.websiteDownloadBlockEmptyUserAgent",
    group: "bot_blocking",
    groupLabel: "爬虫拦截",
    label: "官网下载拦截空 User-Agent",
    description: "是否对 User-Agent 为空的官网下载请求进行 403 拦截",
    type: "boolean",
    defaultValue: false,
    parse: (v) => parseBoolean(v, false),
    validate: (v) => (typeof v === "boolean" ? null : "必须为布尔值"),
  },

  // 加密安全
  {
    key: "security.encryptionTimestampWindowMs",
    group: "encryption",
    groupLabel: "加密安全",
    label: "加密请求时间戳容差窗口",
    description: "客户端请求时间与服务端时间允许的最大偏差（毫秒）",
    type: "number",
    defaultValue: 300000,
    unit: "毫秒",
    min: 30000,
    max: 3600000,
    parse: (v) => parseNumberInRange(v, 30000, 3600000, 300000),
    validate: (v) => (typeof v === "number" && v >= 30000 && v <= 3600000 ? null : "必须在 30000 到 3600000 毫秒之间"),
  },
  {
    key: "security.encryptionNonceTtlMs",
    group: "encryption",
    groupLabel: "加密安全",
    label: "加密 Nonce 防重放 TTL",
    description: "加密 Nonce 记录在内存缓存中的防重放存活时长（毫秒）",
    type: "number",
    defaultValue: 300000,
    unit: "毫秒",
    min: 30000,
    max: 3600000,
    parse: (v) => parseNumberInRange(v, 30000, 3600000, 300000),
    validate: (v) => (typeof v === "number" && v >= 30000 && v <= 3600000 ? null : "必须在 30000 到 3600000 毫秒之间"),
  },
  {
    key: "security.encryptionNonceCacheMax",
    group: "encryption",
    groupLabel: "加密安全",
    label: "Nonce 缓存容量上限",
    description: "内存中保留的最大 Nonce 数量",
    type: "number",
    defaultValue: 50000,
    unit: "条",
    min: 1000,
    max: 500000,
    parse: (v) => parseNumberInRange(v, 1000, 500000, 50000),
    validate: (v) => (typeof v === "number" && v >= 1000 && v <= 500000 ? null : "必须在 1000 到 500000 之间"),
  },

  // 认证与会话
  {
    key: "auth.userJwtTtlSeconds",
    group: "auth",
    groupLabel: "认证与会话",
    label: "用户 Token 有效期",
    description: "普通用户 JWT 登录凭证签发有效期（秒）",
    type: "number",
    defaultValue: 604800,
    unit: "秒",
    min: 300,
    max: 2592000,
    parse: (v) => parseNumberInRange(v, 300, 2592000, 604800),
    validate: (v) => (typeof v === "number" && v >= 300 && v <= 2592000 ? null : "必须在 300 到 2592000 秒之间"),
  },
  {
    key: "auth.adminJwtTtlSeconds",
    group: "auth",
    groupLabel: "认证与会话",
    label: "管理后台 Token 有效期",
    description: "管理员 JWT 凭据签发有效期（秒）",
    type: "number",
    defaultValue: 604800,
    unit: "秒",
    min: 300,
    max: 2592000,
    parse: (v) => parseNumberInRange(v, 300, 2592000, 604800),
    validate: (v) => (typeof v === "number" && v >= 300 && v <= 2592000 ? null : "必须在 300 到 2592000 秒之间"),
  },
  {
    key: "auth.verificationCodeTtlMs",
    group: "verification",
    groupLabel: "验证码",
    label: "验证码有效时长",
    description: "邮箱/短信验证码的有效时间（毫秒）",
    type: "number",
    defaultValue: 300000,
    unit: "毫秒",
    min: 60000,
    max: 1800000,
    parse: (v) => parseNumberInRange(v, 60000, 1800000, 300000),
    validate: (v) => (typeof v === "number" && v >= 60000 && v <= 1800000 ? null : "必须在 60000 到 1800000 毫秒之间"),
  },
  {
    key: "auth.verificationSendCooldownMs",
    group: "verification",
    groupLabel: "验证码",
    label: "验证码重发冷却时间",
    description: "同一联系人再次发送验证码的最小间隔时长（毫秒）",
    type: "number",
    defaultValue: 60000,
    unit: "毫秒",
    min: 10000,
    max: 3600000,
    parse: (v) => parseNumberInRange(v, 10000, 3600000, 60000),
    validate: (v) => (typeof v === "number" && v >= 10000 && v <= 3600000 ? null : "必须在 10000 到 3600000 毫秒之间"),
  },

  // 统计留存
  {
    key: "analytics.retentionDays",
    group: "analytics",
    groupLabel: "统计与留存",
    label: "访问与下载记录保留天数",
    description: "官网访问明细与下载流水记录的最长保留天数（超出自动清理）",
    type: "number",
    defaultValue: 180,
    unit: "天",
    min: 90,
    max: 730,
    parse: (v) => parseNumberInRange(v, 90, 730, 180),
    validate: (v) => (typeof v === "number" && v >= 90 && v <= 730 ? null : "必须在 90 到 730 天之间"),
  },

  // HTTP Payload
  {
    key: "http.jsonBodyLimit",
    group: "http",
    groupLabel: "HTTP限制",
    label: "通用 JSON 请求体上限",
    description: "服务端 express.json 通用解析大小上限",
    type: "string",
    defaultValue: "1mb",
    adminEditable: true,
    parse: (v) => String(v ?? "1mb").trim() || "1mb",
    validate: (v) => (/^\d+(kb|mb|gb|b)$/i.test(String(v)) ? null : "格式必须为如 1mb, 500kb 等"),
  },
  {
    key: "http.faultReportBodyLimit",
    group: "http",
    groupLabel: "HTTP限制",
    label: "故障上报请求体上限",
    description: "故障日志批量提交接口请求体解析上限",
    type: "string",
    defaultValue: "5mb",
    adminEditable: true,
    parse: (v) => String(v ?? "5mb").trim() || "5mb",
    validate: (v) => (/^\d+(kb|mb|gb|b)$/i.test(String(v)) ? null : "格式必须为如 5mb, 10mb 等"),
  },

  // 同步限制
  {
    key: "sync.maxChangesPerPush",
    group: "sync",
    groupLabel: "数据同步",
    label: "单次推送最大变更项数",
    description: "客户端单次向服务端 push 允许提交的最大操作记录数",
    type: "number",
    defaultValue: 500,
    unit: "条",
    min: 1,
    max: 5000,
    parse: (v) => parseNumberInRange(v, 1, 5000, 500),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 5000 ? null : "必须在 1 到 5000 之间"),
  },
  {
    key: "sync.maxChangesPerPull",
    group: "sync",
    groupLabel: "数据同步",
    label: "单次拉取最大变更项数",
    description: "客户端单次 pull 增量变更允许返回的最大操作记录数",
    type: "number",
    defaultValue: 1000,
    unit: "条",
    min: 1,
    max: 10000,
    parse: (v) => parseNumberInRange(v, 1, 10000, 1000),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 10000 ? null : "必须在 1 到 10000 之间"),
  },

  // 故障上报
  {
    key: "faultReports.maxLogsPerBatch",
    group: "fault_reports",
    groupLabel: "故障上报",
    label: "单批次最大日志条数",
    description: "单次故障上报请求包含的最大客户端日志条目数",
    type: "number",
    defaultValue: 300,
    unit: "条",
    min: 1,
    max: 2000,
    parse: (v) => parseNumberInRange(v, 1, 2000, 300),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 2000 ? null : "必须在 1 到 2000 之间"),
  },

  // 反馈与分享
  {
    key: "feedback.maxImageBytes",
    group: "feedback",
    groupLabel: "用户反馈",
    label: "反馈单图最大字节数",
    description: "反馈提交中单张图片附件的最大大小（字节）",
    type: "number",
    defaultValue: 5242880,
    unit: "字节",
    min: 1048576,
    max: 20971520,
    parse: (v) => parseNumberInRange(v, 1048576, 20971520, 5242880),
    validate: (v) => (typeof v === "number" && v >= 1048576 && v <= 20971520 ? null : "必须在 1MB 到 20MB 之间"),
  },
  {
    key: "feedback.maxImages",
    group: "feedback",
    groupLabel: "用户反馈",
    label: "反馈最大附件图片数",
    description: "单条反馈允许附带的最大截图数量",
    type: "number",
    defaultValue: 3,
    unit: "张",
    min: 1,
    max: 10,
    parse: (v) => parseNumberInRange(v, 1, 10, 3),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 10 ? null : "必须在 1 到 10 之间"),
  },
  {
    key: "shares.maxRawJsonBytes",
    group: "shares",
    groupLabel: "分享数据",
    label: "分享原始 JSON 最大大小",
    description: "歌曲/歌单分享保存的原始 JSON 数据体积上限（字节）",
    type: "number",
    defaultValue: 65536,
    unit: "字节",
    min: 4096,
    max: 1048576,
    parse: (v) => parseNumberInRange(v, 4096, 1048576, 65536),
    validate: (v) => (typeof v === "number" && v >= 4096 && v <= 1048576 ? null : "必须在 4KB 到 1MB 之间"),
  },

  // 听歌记录与片段
  {
    key: "listening.maxFragmentDurationMs",
    group: "listening",
    groupLabel: "听歌上报",
    label: "单听歌片段最大允许时长",
    description: "单次上报片段 [startedAtMs, endedAtMs) 允许的最大时间跨度（毫秒）",
    type: "number",
    defaultValue: 960000,
    unit: "毫秒",
    min: 60000,
    max: 7200000,
    parse: (v) => parseNumberInRange(v, 60000, 7200000, 960000),
    validate: (v) => (typeof v === "number" && v >= 60000 && v <= 7200000 ? null : "必须在 1 分钟到 2 小时之间"),
  },
  {
    key: "listening.maxFutureMs",
    group: "listening",
    groupLabel: "听歌上报",
    label: "听歌时间戳未来容差",
    description: "听歌片段结束时间允许超过服务端当前时间的最大容差（毫秒）",
    type: "number",
    defaultValue: 300000,
    unit: "毫秒",
    min: 0,
    max: 3600000,
    parse: (v) => parseNumberInRange(v, 0, 3600000, 300000),
    validate: (v) => (typeof v === "number" && v >= 0 && v <= 3600000 ? null : "必须在 0 到 3600000 毫秒之间"),
  },
  {
    key: "listening.maxFragmentsPerBatch",
    group: "listening",
    groupLabel: "听歌上报",
    label: "单次批量上报最大片段数",
    description: "客户端单次批量提交的最大听歌记录片段数量",
    type: "number",
    defaultValue: 200,
    unit: "条",
    min: 1,
    max: 2000,
    parse: (v) => parseNumberInRange(v, 1, 2000, 200),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 2000 ? null : "必须在 1 到 2000 之间"),
  },

  // 一起听房间
  {
    key: "listenTogether.minPeople",
    group: "listen_together",
    groupLabel: "一起听",
    label: "房间最小人数限制",
    description: "创建一起听房间允许设置的最小人数上限",
    type: "number",
    defaultValue: 2,
    unit: "人",
    min: 2,
    max: 100,
    parse: (v) => parseNumberInRange(v, 2, 100, 2),
    validate: (v) => (typeof v === "number" && v >= 2 && v <= 100 ? null : "必须在 2 到 100 之间"),
  },
  {
    key: "listenTogether.defaultMaxPeople",
    group: "listen_together",
    groupLabel: "一起听",
    label: "创建房间默认人数上限",
    description: "客户端未显式传参时房间默认最大人数",
    type: "number",
    defaultValue: 2,
    unit: "人",
    min: 2,
    max: 100,
    parse: (v) => parseNumberInRange(v, 2, 100, 2),
    validate: (v) => (typeof v === "number" && v >= 2 && v <= 100 ? null : "必须在 2 到 100 之间"),
  },
  {
    key: "listenTogether.maxPeopleLimit",
    group: "listen_together",
    groupLabel: "一起听",
    label: "房间允许最大人数上限",
    description: "系统允许单个房间容纳的人数绝对上限（替代旧 listen_together_max_people）",
    type: "number",
    defaultValue: 8,
    unit: "人",
    min: 2,
    max: 100,
    parse: (v) => parseNumberInRange(v, 2, 100, 8),
    validate: (v) => (typeof v === "number" && v >= 2 && v <= 100 ? null : "必须在 2 到 100 之间"),
  },
  {
    key: "listenTogether.roomIdMinLength",
    group: "listen_together",
    groupLabel: "一起听",
    label: "房间号最小字符数",
    description: "生成或输入房间号的最小长度",
    type: "number",
    defaultValue: 4,
    min: 4,
    max: 32,
    parse: (v) => parseNumberInRange(v, 4, 32, 4),
    validate: (v) => (typeof v === "number" && v >= 4 && v <= 32 ? null : "必须在 4 到 32 之间"),
  },
  {
    key: "listenTogether.roomIdMaxLength",
    group: "listen_together",
    groupLabel: "一起听",
    label: "房间号最大字符数",
    description: "生成或输入房间号的最大长度",
    type: "number",
    defaultValue: 8,
    min: 4,
    max: 32,
    parse: (v) => parseNumberInRange(v, 4, 32, 8),
    validate: (v) => (typeof v === "number" && v >= 4 && v <= 32 ? null : "必须在 4 到 32 之间"),
  },
  {
    key: "listenTogether.roomIdDefaultLength",
    group: "listen_together",
    groupLabel: "一起听",
    label: "默认生成房间号长度",
    description: "创建房间时默认随机生成的数字/字母长度",
    type: "number",
    defaultValue: 6,
    min: 4,
    max: 32,
    parse: (v) => parseNumberInRange(v, 4, 32, 6),
    validate: (v) => (typeof v === "number" && v >= 4 && v <= 32 ? null : "必须在 4 到 32 之间"),
  },
  {
    key: "listenTogether.offlineGraceMs",
    group: "listen_together",
    groupLabel: "一起听",
    label: "成员掉线宽限期",
    description: "成员意外断开连接后保留房间席位的宽限时长（毫秒）",
    type: "number",
    defaultValue: 30000,
    unit: "毫秒",
    min: 0,
    max: 600000,
    parse: (v) => parseNumberInRange(v, 0, 600000, 30000),
    validate: (v) => (typeof v === "number" && v >= 0 && v <= 600000 ? null : "必须在 0 到 600000 毫秒之间"),
  },

  // 存储与七牛
  {
    key: "storage.releaseUploadTokenTtlSeconds",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "安装包上传凭证有效期",
    description: "管理端上传安装包/更新文件时签发的 uploadToken 有效时长（秒）",
    type: "number",
    defaultValue: 3600,
    unit: "秒",
    min: 60,
    max: 86400,
    parse: (v) => parseNumberInRange(v, 60, 86400, 3600),
    validate: (v) => (typeof v === "number" && v >= 60 && v <= 86400 ? null : "必须在 60 到 86400 秒之间"),
  },
  {
    key: "storage.releaseDownloadUrlTtlSeconds",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "安装包私有下载链接有效期",
    description: "安装包和 PC 自动更新文件签名下载 URL 的有效期（秒）",
    type: "number",
    defaultValue: 300,
    unit: "秒",
    min: 60,
    max: 3600,
    parse: (v) => parseNumberInRange(v, 60, 3600, 300),
    validate: (v) => (typeof v === "number" && v >= 60 && v <= 3600 ? null : "必须在 60 到 3600 秒之间"),
  },
  {
    key: "storage.cloudMusicAssetUrlTtlSeconds",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "网盘音乐播放/歌词签名有效期",
    description: "云盘歌曲音频与歌词私有签名链接有效时长（秒）",
    type: "number",
    defaultValue: 3600,
    unit: "秒",
    min: 60,
    max: 86400,
    parse: (v) => parseNumberInRange(v, 60, 86400, 3600),
    validate: (v) => (typeof v === "number" && v >= 60 && v <= 86400 ? null : "必须在 60 到 86400 秒之间"),
  },
  {
    key: "storage.cloudMusicMetadataUrlTtlSeconds",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "网盘音频元数据解析内部链接有效期",
    description: "服务端直传校验和提取音频元数据时的临时私有 URL 有效时长（秒）",
    type: "number",
    defaultValue: 300,
    unit: "秒",
    min: 60,
    max: 3600,
    parse: (v) => parseNumberInRange(v, 60, 3600, 300),
    validate: (v) => (typeof v === "number" && v >= 60 && v <= 3600 ? null : "必须在 60 到 3600 秒之间"),
  },
  {
    key: "storage.accountAvatarMaxBytes",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "用户头像最大大小",
    description: "用户上传头像文件的最大体积（字节）",
    type: "number",
    defaultValue: 5242880,
    unit: "字节",
    min: 1048576,
    max: 20971520,
    parse: (v) => parseNumberInRange(v, 1048576, 20971520, 5242880),
    validate: (v) => (typeof v === "number" && v >= 1048576 && v <= 20971520 ? null : "必须在 1MB 到 20MB 之间"),
  },
  {
    key: "storage.releaseImageMaxBytes",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "版本发布图片最大大小",
    description: "公告与发布相关图片文件的最大体积（字节）",
    type: "number",
    defaultValue: 10485760,
    unit: "字节",
    min: 1048576,
    max: 52428800,
    parse: (v) => parseNumberInRange(v, 1048576, 52428800, 10485760),
    validate: (v) => (typeof v === "number" && v >= 1048576 && v <= 52428800 ? null : "必须在 1MB 到 50MB 之间"),
  },
  {
    key: "storage.cloudMusicAudioMaxBytes",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "网盘音频文件最大大小",
    description: "网盘歌曲单曲音频文件上传体积上限（字节）",
    type: "number",
    defaultValue: 524288000,
    unit: "字节",
    min: 10485760,
    max: 2147483648,
    parse: (v) => parseNumberInRange(v, 10485760, 2147483648, 524288000),
    validate: (v) => (typeof v === "number" && v >= 10485760 && v <= 2147483648 ? null : "必须在 10MB 到 2GB 之间"),
  },
  {
    key: "storage.cloudMusicCoverMaxBytes",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "网盘歌曲封面最大大小",
    description: "网盘歌曲封面图片上传体积上限（字节）",
    type: "number",
    defaultValue: 10485760,
    unit: "字节",
    min: 1048576,
    max: 52428800,
    parse: (v) => parseNumberInRange(v, 1048576, 52428800, 10485760),
    validate: (v) => (typeof v === "number" && v >= 1048576 && v <= 52428800 ? null : "必须在 1MB 到 50MB 之间"),
  },
  {
    key: "storage.cloudMusicLyricsMaxBytes",
    group: "storage",
    groupLabel: "七牛与存储",
    label: "网盘歌词文件最大大小",
    description: "网盘歌词 lrc 文件体积上限（字节）",
    type: "number",
    defaultValue: 2097152,
    unit: "字节",
    min: 1024,
    max: 20971520,
    parse: (v) => parseNumberInRange(v, 1024, 20971520, 2097152),
    validate: (v) => (typeof v === "number" && v >= 1024 && v <= 20971520 ? null : "必须在 1KB 到 20MB 之间"),
  },

  // 公告校验
  {
    key: "announcement.maxBlocks",
    group: "announcement",
    groupLabel: "公告管理",
    label: "公告最大 Block 块数",
    description: "单条公告包含的内容块最大数量",
    type: "number",
    defaultValue: 100,
    min: 1,
    max: 1000,
    parse: (v) => parseNumberInRange(v, 1, 1000, 100),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 1000 ? null : "必须在 1 到 1000 之间"),
  },
  {
    key: "announcement.maxTextLength",
    group: "announcement",
    groupLabel: "公告管理",
    label: "公告全文最大字符数",
    description: "单条公告总文本长度上限",
    type: "number",
    defaultValue: 50000,
    min: 1000,
    max: 500000,
    parse: (v) => parseNumberInRange(v, 1000, 500000, 50000),
    validate: (v) => (typeof v === "number" && v >= 1000 && v <= 500000 ? null : "必须在 1000 到 500000 之间"),
  },
  {
    key: "announcement.maxBlockTextLength",
    group: "announcement",
    groupLabel: "公告管理",
    label: "单 Block 最大文本字符数",
    description: "公告中单块文本段落长度上限",
    type: "number",
    defaultValue: 10000,
    min: 100,
    max: 100000,
    parse: (v) => parseNumberInRange(v, 100, 100000, 10000),
    validate: (v) => (typeof v === "number" && v >= 100 && v <= 100000 ? null : "必须在 100 到 100000 之间"),
  },
  {
    key: "announcement.maxCopyLength",
    group: "announcement",
    groupLabel: "公告管理",
    label: "单 Block 复制文本最大字符数",
    description: "公告中包含的复制按钮文本长度上限",
    type: "number",
    defaultValue: 10000,
    min: 100,
    max: 100000,
    parse: (v) => parseNumberInRange(v, 100, 100000, 10000),
    validate: (v) => (typeof v === "number" && v >= 100 && v <= 100000 ? null : "必须在 100 到 100000 之间"),
  },
  {
    key: "announcement.maxLabelLength",
    group: "announcement",
    groupLabel: "公告管理",
    label: "按钮 Label 最大字符数",
    description: "公告中动作按钮文本长度上限",
    type: "number",
    defaultValue: 100,
    min: 1,
    max: 1000,
    parse: (v) => parseNumberInRange(v, 1, 1000, 100),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 1000 ? null : "必须在 1 到 1000 之间"),
  },
  {
    key: "announcement.maxAltLength",
    group: "announcement",
    groupLabel: "公告管理",
    label: "图片 Alt 最大字符数",
    description: "公告图片描述文本长度上限",
    type: "number",
    defaultValue: 200,
    min: 1,
    max: 2000,
    parse: (v) => parseNumberInRange(v, 1, 2000, 200),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 2000 ? null : "必须在 1 到 2000 之间"),
  },
  {
    key: "announcement.maxFileIdLength",
    group: "announcement",
    groupLabel: "公告管理",
    label: "文件 ID 最大字符数",
    description: "公告关联图片文件 ID 字符串长度上限",
    type: "number",
    defaultValue: 120,
    min: 1,
    max: 1000,
    parse: (v) => parseNumberInRange(v, 1, 1000, 120),
    validate: (v) => (typeof v === "number" && v >= 1 && v <= 1000 ? null : "必须在 1 到 1000 之间"),
  },
] as const;

export const DEFINITION_MAP = new Map<string, ConfigDefinition>(
  CONFIG_DEFINITIONS.map((def) => [def.key, def]),
);

export function getConfigDefinition(key: string): ConfigDefinition | undefined {
  return DEFINITION_MAP.get(key);
}

export function validateConfigBatch(
  changes: readonly { key: string; value: ConfigJsonValue }[],
): { valid: boolean; error?: string; normalized: { key: string; value: ConfigJsonValue }[] } {
  const normalized: { key: string; value: ConfigJsonValue }[] = [];
  const keysSet = new Set<string>();

  for (const item of changes) {
    const key = String(item.key ?? "").trim();
    if (!key) return { valid: false, error: "配置 key 不能为空", normalized: [] };
    if (keysSet.has(key)) return { valid: false, error: `重复提交配置 key: ${key}`, normalized: [] };
    keysSet.add(key);

    const def = DEFINITION_MAP.get(key);
    if (!def) {
      return { valid: false, error: `未知或不允许修改的配置 key: ${key}`, normalized: [] };
    }
    if (def.adminEditable === false) {
      return { valid: false, error: `配置项 ${key} 为只读项，不允许通过后台修改`, normalized: [] };
    }

    const val = def.parse ? def.parse(item.value) : item.value;
    if (def.validate) {
      const err = def.validate(val);
      if (err) return { valid: false, error: `配置 ${def.label} (${key}) 校验失败: ${err}`, normalized: [] };
    }
    normalized.push({ key, value: val });
  }

  // 跨字段联合校验 (Cross-field validation)
  const map = new Map<string, ConfigJsonValue>(normalized.map((n) => [n.key, n.value]));
  const minRoom = map.get("listenTogether.roomIdMinLength");
  const maxRoom = map.get("listenTogether.roomIdMaxLength");
  const defRoom = map.get("listenTogether.roomIdDefaultLength");
  if (typeof minRoom === "number" && typeof maxRoom === "number" && minRoom > maxRoom) {
    return { valid: false, error: "房间号最小长度不能大于最大长度", normalized: [] };
  }
  if (typeof defRoom === "number") {
    if (typeof minRoom === "number" && defRoom < minRoom) {
      return { valid: false, error: "房间号默认长度不能小于最小长度", normalized: [] };
    }
    if (typeof maxRoom === "number" && defRoom > maxRoom) {
      return { valid: false, error: "房间号默认长度不能大于最大长度", normalized: [] };
    }
  }

  const minPeople = map.get("listenTogether.minPeople");
  const maxPeople = map.get("listenTogether.maxPeopleLimit");
  const defPeople = map.get("listenTogether.defaultMaxPeople");
  if (typeof minPeople === "number" && typeof maxPeople === "number" && minPeople > maxPeople) {
    return { valid: false, error: "一起听最小人数限制不能大于最大人数限制", normalized: [] };
  }
  if (typeof defPeople === "number") {
    if (typeof minPeople === "number" && defPeople < minPeople) {
      return { valid: false, error: "默认人数上限不能小于最小人数限制", normalized: [] };
    }
    if (typeof maxPeople === "number" && defPeople > maxPeople) {
      return { valid: false, error: "默认人数上限不能大于最大人数限制", normalized: [] };
    }
  }

  return { valid: true, normalized };
}
