# 分页查询 PC 桌面设备列表

管理后台分页查询所有上报过信息的 PC 桌面端设备列表（从 `desktop_device_info` 表读取）。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/desktop-device/list`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `search` | `string` | 否 | 设备名/主机名/系统名/设备ID 模糊搜索关键词 |
| `locked` | `string` | 否 | 封禁状态：`true` 或 `false` |
| `platform` | `string` | 否 | 平台（如 `win32`） |
| `offset` | `number` | 否 | 分页起始偏移量，默认 0 |
| `limit` | `number` | 否 | 每页条数（1-100，默认 20） |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "devices": [
      {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "fingerprint": "desktop_fp...",
        "deviceName": "DESKTOP-PARTIAL",
        "hostname": "DESKTOP-PARTIAL",
        "osName": "Windows 11 Pro",
        "osVersion": "10.0.22631",
        "platform": "win32",
        "arch": "x64",
        "appVersion": "1.5.0",
        "locked": false,
        "lockEndTime": null,
        "firstSeenAt": 1695000000000,
        "lastActiveAt": 1700000000000,
        "firstSeenIp": "120.24.0.2",
        "lastSeenIp": "120.24.0.2",
        "extraInfo": {}
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  },
  "success": true
}
```
