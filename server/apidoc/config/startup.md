# Android 冷启动聚合配置与初始化

在单次加密请求内完成停服检查、Android 设备上报、系统账号令牌静默校验与刷新、未读专属消息查询，以及 `bootstrap` / `update` / `agreement` / `announcements` 配置聚合下发。原单独接口继续保留兼容历史客户端与桌面端。

- **请求方法**：`POST`
- **请求路径**：`/api/config/startup`
- **需要鉴权**：可选 `Authorization: Bearer <UserToken>`（仅刷新已有系统账号登录态，未传或过期不阻断启动）
- **加密模式**：端到端加密（`x-pm-random` + 信封体）

---

## 请求参数

### 请求体

```json
{
  "device": {
    "androidId": "9774d56d682e549c",
    "deviceName": "Pixel 8",
    "brand": "Google",
    "model": "Pixel 8",
    "osVersion": "15",
    "sdkVersion": 35,
    "appVersion": "2.4.0",
    "appVersionCode": 20400,
    "certModel": "GPJ41",
    "countryCode": "CN",
    "timezone": "Asia/Shanghai",
    "locale": "zh-CN",
    "extras": {}
  },
  "agreementVersion": 1,
  "unreadMessageLimit": 20
}
```

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `device` | `object` | 是 | Android 设备上报结构（与 `POST /api/device/report` 一致） |
| `agreementVersion` | `number` | 否 | 客户端本地已同意的用户协议版本号；与服务端一致时 `agreement.acceptedUpToDate` 为 `true` 并省略正文 |
| `unreadMessageLimit` | `number` | 否 | 未读专属消息最大返回条数 |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "bootstrap": {
      "version": "1.0.0",
      "updatedAt": 1700000000000,
      "endpoints": {},
      "gatewaySign": { "secret": "...", "as": "..." }
    },
    "update": {
      "latestVersion": "2.4.0",
      "updateTime": "2026-11-19",
      "forceUpdate": false,
      "downloadUrl": "https://pm.hs.partialy.cn/...",
      "officialUrl": "https://pisamusic.partialy.cn",
      "updateContent": ""
    },
    "agreement": {
      "version": 1,
      "acceptedUpToDate": true,
      "title": "",
      "content": ""
    },
    "device": {
      "id": "uuid",
      "messageToken": "jwt",
      "locked": false,
      "lockEndTime": null,
      "lastActiveAt": 1700000000000,
      "firstSeenAt": 1700000000000
    },
    "announcements": [],
    "account": {
      "status": "none",
      "session": null
    },
    "unreadMessages": {
      "items": [],
      "hasMore": false
    }
  },
  "success": true
}
```

### 停服拦截响应

- 当站点处于停服维护状态时返回 HTTP `200`，业务 `code = -233`、`success = false`，客户端直接跳转全屏拦截页。
- 单台设备封禁仍返回 `code = 0`，由 `data.device.locked = true` 与 `lockEndTime` 标识。
