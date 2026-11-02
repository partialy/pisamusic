# 官网安装包下载重定向与统计

官网对外公开的快捷下载入口，访问后会自动记录下载统计事件（平台、版本、IP、User-Agent、Referrer 等），并 302 重定向至对应平台的最新安装包真实下载地址。

- **请求方法**：`GET`
- **请求路径**：`/api/config/download/:platform`
- **需要鉴权**：否
- **加密模式**：明文白名单路径

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `platform` | `string` | 是 | 平台类型，可选值：`android` 或 `desktop` |

---

## 响应数据

- **HTTP 302 Found**：重定向到配置的安装包下载地址（七牛对象在本次请求先校验并签名，或使用指定直链）。
- 手填直链兼容 HTTP/HTTPS 完整 URL 与 `/uploads/releases/pisa.apk` 等站内根相对路径；不接受协议相对地址、反斜杠、控制字符及循环指向下载统计入口的地址。
- **404 Not Found**（JSON）：平台未配置或未开放下载（`available = false`）。
- **403 Forbidden**（JSON）：系统处于停机维护状态。

## 推广下载归因

可选 query `code` 为6位大小写敏感Base62。显式有效code优先；显式非法/失效code不回退旧Cookie；没有code时从有效签名Cookie查最近7天最后有效触点。推广日志与原有官网download_records在单SQLite事务内各写一次，原统计保持独立。仅在发布可用、对象有效及跳转URL成功生成后记为下载触发，不代表文件完成、安装或注册。无包、错误平台、被拦截/限流时不计数。统计失败记录诊断但仍允许下载，不重试写日志以免双写。

302设置 `Referrer-Policy: no-referrer`、`Cache-Control: no-store`，不向七牛/外部目标追加code。公开短链归因详见 [App推广追踪](../appShare/tracking.md)。
