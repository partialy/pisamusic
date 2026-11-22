# PC 桌面端冷启动聚合配置与初始化

在单次加密请求内完成停服检查、PC 桌面设备上报、系统账号令牌静默校验与刷新、未读专属消息查询，以及 `bootstrap` / `update`（`releases.desktop`）/ `agreement` / `announcements` 配置聚合下发。原单独接口继续保留兼容历史桌面版本及显式刷新场景。

- **请求方法**：`POST`
- **请求路径**：`/api/config/desktop-startup`
- **需要鉴权**：可选 `Authorization: Bearer <UserToken>`（仅刷新已有系统账号登录态，未传或过期不阻断启动）
- **加密模式**：端到端加密（`x-pm-random` + 信封体）

---

## 请求参数

### 请求体

```json
{
  "device": {
    "clientId": "e3a9e8b8-42c5-4b11-a389-801a7e17f9a0",
    "deviceName": "DESKTOP-WORKSTATION",
    "hostname": "DESKTOP-WORKSTATION",
    "osName": "Windows_NT",
    "osVersion": "10.0.22631",
    "platform": "win32",
    "arch": "x64",
    "appVersion": "2.0.2",
    "extras": {
      "homedir": "C:\\Users\\Demo",
      "totalMemory": 34359738368,
      "cpus": 16
    }
  },
  "agreementVersion": 1,
  "unreadMessageLimit": 20
}
```

| 字段名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `device` | `object` | 是 | PC 桌面设备上报结构（与 `POST /api/device/desktop/report` 一致） |
| `agreementVersion` | `number` | 否 | 客户端本地已同意的用户协议版本号；与服务端一致时 `agreement.acceptedUpToDate` 为 `true` 并省略正文 |
| `unreadMessageLimit` | `number` | 否 | 未读专属消息最大返回条数（同时兼容 `directMessageLimit`） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "serverTime": 1763820000000,
    "bootstrap": {
      "version": "1.0.0",
      "updatedAt": 1700000000000,
      "endpoints": {},
      "gatewaySign": { "secret": "...", "as": "..." },
      "updater": {
        "desktop": {
          "enabled": true,
          "feedBaseUrl": "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64",
          "checkOnStartup": true,
          "startupDelayMs": 3000
        }
      }
    },
    "update": {
      "latestVersion": "2.0.2",
      "updateTime": "2026-11-19",
      "forceUpdate": false,
      "downloadUrl": "https://pm.hs.partialy.cn/...",
      "officialUrl": "https://pisamusic.partialy.cn",
      "updateContent": "",
      "platformLabel": "Windows 桌面端",
      "fileSizeText": "86.5 MB",
      "available": true
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

### 停服与封禁响应

- 当站点处于停服维护状态时返回 HTTP `200`，业务 `code = -233`、`success = false`，桌面端禁止跳过或走本地模式进入，应直接拦截提示。
- 单台桌面设备封禁仍返回 `code = 0`，由 `data.device.locked = true` 与 `lockEndTime` 标识，客户端应立即拦截。
- 若 `data.agreement.acceptedUpToDate = false`，客户端应在显露主窗口前切换到协议确认视图并等待用户同意新版本。
