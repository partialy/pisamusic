# 获取启动配置与服务网关

客户端（Android / PC）启动时拉取的第 1 层基础配置，包含 API 服务网关、第三方音乐接口端点、网关验签密钥及 PC 自动升级策略。

- **请求方法**：`GET`
- **请求路径**：`/api/config/bootstrap`
- **需要鉴权**：否
- **加密模式**：明文返回

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "version": "1.0.0",
    "updatedAt": 1700000000000,
    "endpoints": {
      "kw_search": "https://gateway.partialy.cn/kw/search",
      "kg_search": "https://gateway.partialy.cn/kg/search",
      "wy_search": "https://gateway.partialy.cn/wy/search",
      "tx_search": "https://gateway.partialy.cn/tx/search"
    },
    "gatewaySign": {
      "secret": "gateway_sign_secret_key",
      "as": "pmsign"
    },
    "updater": {
      "desktop": {
        "enabled": true,
        "feedBaseUrl": "https://pisamusic.partialy.cn/api/config/desktop-updates/win32/x64",
        "checkOnStartup": true,
        "startupDelayMs": 3000
      }
    }
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `version` | `string` | 启动配置版本号 |
| `updatedAt` | `number` | 配置更新时间戳 |
| `endpoints` | `Record<string, string>` | 音乐源与网关路由端点映射字典 |
| `gatewaySign.secret` | `string` | 客户端请求网关时的签名私钥 |
| `gatewaySign.as` | `string` | 客户端请求网关时的签名 Header / Query 名称 |
| `updater.desktop.enabled` | `boolean` | 是否开启 PC 自动更新 |
| `updater.desktop.feedBaseUrl` | `string` | `electron-updater` 使用的 generic feed 基地址 |
| `updater.desktop.checkOnStartup` | `boolean` | 是否在软件启动后自动检查更新 |
| `updater.desktop.startupDelayMs` | `number` | 启动后延迟检查更新的毫秒数 |

### 停机维护响应

当后台开启停机维护（`appAvailable = false`）时，接口返回 `-233` 错误码及停机提示：

```json
{
  "code": -233,
  "msg": "服务器正在例行维护，预计 12:00 恢复",
  "data": null,
  "success": false
}
```
