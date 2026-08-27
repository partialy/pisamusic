# PC 桌面端设备信息上报与日活记录

PC 桌面端（Windows / Electron）客户端启动或活跃时上报设备硬件、系统版本、应用版本等信息，同时自动记录设备每日活跃记录。服务端根据 `clientId`、`hostname`、`platform`、`arch` 的 SHA-256 哈希计算设备唯一指纹，并维护在 `desktop_device_info` 独立表中。

- **请求方法**：`POST`
- **请求路径**：`/api/device/desktop/report`
- **需要鉴权**：否
- **加密模式**：端到端加密

---

## 请求参数

### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `clientId` | `string` | 是 | 客户端持久化生成的唯一 Client ID（最大长度 256） |
| `deviceName` | `string` | 是 | 电脑设备名称 |
| `hostname` | `string` | 是 | 计算机主机名 |
| `osName` | `string` | 是 | 操作系统名称（如 "Windows 11 Pro"） |
| `osVersion` | `string` | 是 | 操作系统版本号（如 "10.0.22631"） |
| `platform` | `string` | 是 | 操作系统平台（如 "win32"） |
| `arch` | `string` | 是 | 硬件架构（如 "x64"） |
| `appVersion` | `string` | 是 | 应用版本号（如 "1.5.0"） |
| `extras` | `object` | 否 | 扩展设备信息 JSON 键值对 |

### 请求示例

```json
{
  "clientId": "d-client-uuid-123456",
  "deviceName": "DESKTOP-PARTIAL",
  "hostname": "DESKTOP-PARTIAL",
  "osName": "Windows 11 Pro",
  "osVersion": "10.0.22631",
  "platform": "win32",
  "arch": "x64",
  "appVersion": "1.5.0"
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
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "locked": false,
    "lockEndTime": null,
    "lastActiveAt": 1700000000000,
    "firstSeenAt": 1695000000000
  },
  "success": true
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | `string` | 服务端生成的 PC 设备唯一 UUID |
| `locked` | `boolean` | 当前设备是否被封禁/锁定 |
| `lockEndTime` | `number \| null` | 封禁到期时间戳毫秒数 |
| `lastActiveAt` | `number` | 最近一次活跃上报时间戳 |
| `firstSeenAt` | `number` | 首次上报入库时间戳 |
