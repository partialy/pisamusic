# 获取 Android 设备详情

根据设备 ID 查询该 Android 设备的完整硬件、网络与活跃状态信息。

- **请求方法**：`GET`
- **请求路径**：`/api/admin/device/:id`
- **需要鉴权**：是（`Authorization: Bearer <AdminToken>`）
- **加密模式**：端到端加密

---

## 请求参数

### Path Parameters

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | `string` | 是 | 设备 UUID |

---

## 响应数据

### 成功响应

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
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
  },
  "success": true
}
```
