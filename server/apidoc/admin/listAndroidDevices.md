# 分页查询 Android 设备列表

管理后台分页查询所有上报过信息的 Android 设备列表，支持按关键词、品牌、封禁状态筛选。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/device/list`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Query Parameters

| 参数名 | 类型 | 必填 | 说明与限制 |
| :--- | :--- | :--- | :--- |
| `search` | `string` | 否 | 品牌/型号/设备名/设备ID 模糊搜索关键词 |
| `locked` | `string` | 否 | 封禁状态过滤：`true`（已封禁）或 `false`（未封禁） |
| `brand` | `string` | 否 | 品牌筛选 |
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
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "fingerprint": "sha256_fp...",
        "deviceName": "Xiaomi 14",
        "brand": "Xiaomi",
        "model": "23127PN0CC",
        "osVersion": "14",
        "sdkVersion": 34,
        "appVersion": "2.1.0",
        "appVersionCode": 210,
        "locked": false,
        "lockEndTime": null,
        "firstSeenAt": 1690000000000,
        "lastActiveAt": 1700000000000,
        "firstSeenIp": "120.24.0.1",
        "lastSeenIp": "120.24.0.1",
        "lastCountryCode": "CN",
        "lastTimezone": "Asia/Shanghai",
        "lastLocale": "zh-CN",
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
