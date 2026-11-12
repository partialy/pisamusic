# 官网页面 PV 与每日域名 UV 上报

- `POST /api/analytics/page-view`，无需鉴权，明文白名单；仅由正常执行脚本的浏览器采集，已识别爬虫跳过。
- 同源 `/api` 反代必须保留 `Host`，例如 `proxy_set_header Host $host;`。Server 不信任 `X-Forwarded-Host` 或 body 中的域名，不维护域名白名单。

## 请求体

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `eventId` | 是 | 本次导航事件 UUID，网络重试必须复用；新导航/刷新生成新 ID |
| `visitorId` | 是 | 浏览器持久化 UUID，与旧访问上报一致 |
| `path` | 否 | 默认 `/`，必须以 `/` 开头；归一化公开页面类别，去查询参数、短码和 Fragment |
| `referrer` | 否 | HTTP(S) 来源；去认证、query、Fragment，分享/扫码/下载路径脱敏，最多 512 字符 |
| `language` / `timezone` | 否 | 最多 32 / 64 字符 |
| `screenWidth` / `screenHeight` | 否 | 0–20000 的整数 |

## 响应

使用统一响应封装，`data` 示例：

```json
{ "pvAccepted": true, "uvAccepted": true, "visitDay": "2026-11-11" }
```

PV 主键为事件 UUID，UV 唯一键为北京时间自然日＋规范域名＋访客 hash，两项写入共用事务。重复事件两个 accepted 均为 false，跨午夜重试也不额外创建 UV；仅返回本次服务端处理日，不信任客户端事件时间。已识别爬虫两个 accepted 均为 false。

同域同访客当天三次导航对应 UV=1/PV=3；跨域分别计 UV，全站指标称累计日 UV。旧 `/api/analytics/site-visit` 保留，只记录 UV，无法补生成历史 PV。未知/无效 Host 记录空域名，不拒绝采集。历史域名不猜测、不回填。

错误：非法 UUID、请求体或路径返回 400，持久化失败返回 500。默认明细保留 180 天，沿用 `ANALYTICS_RETENTION_DAYS`。
