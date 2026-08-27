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

- **HTTP 302 Found**：重定向到配置的安装包下载地址（通常为 `/api/config/release-files/:id/download` 或指定直链）。
- **404 Not Found**（JSON）：平台未配置或未开放下载（`available = false`）。
- **403 Forbidden**（JSON）：系统处于停机维护状态。
