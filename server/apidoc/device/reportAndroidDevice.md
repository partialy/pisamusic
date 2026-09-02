# Android 设备信息上报与日活记录

Android 客户端启动或活跃时上报设备硬件、系统版本、应用版本等信息，同时自动记录设备每日活跃记录。服务端根据 `androidId` 与 `model` 的 SHA-256 哈希作为设备唯一指纹，支持封禁状态检查。

- **请求方法**：`POST`
- **请求路径**：`/api/device/report`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `androidId` | `string` | 是 | Android ID 字符串（最大长度 256） |
| `deviceName` | `string` | 是 | 设备自定义名称（如 "我的小米手机"） |
| `brand` | `string` | 是 | 手机品牌（如 "Xiaomi"） |
| `model` | `string` | 是 | 手机型号（如 "23127PN0CC"） |
| `osVersion` | `string` | 是 | 操作系统版本（如 "14"） |
| `sdkVersion` | `number` | 是 | Android SDK API 级别（如 34） |
| `appVersion` | `string` | 是 | 应用版本名（如 "2.1.0"） |
| `appVersionCode` | `number` | 是 | 应用版本号（如 210） |
| `certModel` | `string` | 否 | 认证型号 |
| `countryCode` | `string` | 否 | 国家地区代码（如 "CN"） |
| `timezone` | `string` | 否 | 时区（如 "Asia/Shanghai"） |
| `locale` | `string` | 否 | 语言区域（如 "zh-CN"） |
| `extras` | `object` | 否 | 扩展设备信息 JSON 键值对 |

### 请求示例

```json
{
  "androidId": "9774d56d682e549c",
  "deviceName": "Xiaomi 14",
  "brand": "Xiaomi",
  "model": "23127PN0CC",
  "osVersion": "14",
  "sdkVersion": 34,
  "appVersion": "2.1.0",
  "appVersionCode": 210,
  "countryCode": "CN",
  "timezone": "Asia/Shanghai",
  "locale": "zh-CN"
}
```

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "messageToken": "eyJhbGciOiJIUzI1NiIs...",
    "locked": false,
    "lockEndTime": null,
    "lastActiveAt": 1700000000000,
    "firstSeenAt": 1690000000000
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 服务端生成的设备唯一 UUID |
| `messageToken` | `string` | 有效期 30 天的设备专属消息凭证。仅作为 `/api/messages/*` 的 `x-pm-device-token` 发送；不得记录日志、展示给用户、作为 User JWT 使用，且不能用设备 UUID 替代。 |
| `locked` | `boolean` | 当前设备是否被封禁/锁定 |
| `lockEndTime` | `number \| null` | 封禁到期时间戳毫秒数，若为永久封禁则为 `null` 但 `locked=true` |
| `lastActiveAt` | `number` | 最近一次活跃上报时间戳 |
| `firstSeenAt` | `number` | 首次上报入库时间戳 |
